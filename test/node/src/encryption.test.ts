import { createSandbox, stub } from 'sinon'
import { ColumnType, EncryptionPlugin, Generated, Kysely, RawBuilder, sql, EncryptedValue } from '../../../dist/cjs'
import * as crypto from "node:crypto"
import {
  BUILT_IN_DIALECTS,
  destroyTest,
  initTest,
  TestContext,
  testSql,
  expect,
  createTableWithId,
} from './test-setup.js'

for (const dialect of ["postgres"] as const) {
  describe(`${dialect}: encryption case test`, () => {
    let ctx: TestContext
    let encryptionDb: Kysely<EncryptionDatabase>

    interface EncryptionPerson {
      id: Generated<number>
      first_name: string
      last_name: string
      salary: EncryptedValue<number>
      preferences?: {
        disable_emails: boolean
      }
    }

    interface EncryptionDatabase {
      encryption_person: EncryptionPerson
    }

    before(async function () {
      ctx = await initTest(this, dialect)
      const spy = stub(crypto, "randomBytes").callsFake(() => "a".repeat(16));

      encryptionDb = new Kysely<EncryptionDatabase>({
        ...ctx.config,
        plugins: [new EncryptionPlugin({
          cryptoKey: "a".repeat(32)
        })],
      })

      await encryptionDb.schema.dropTable('encryption_person').ifExists().execute()
      await createTableWithId(encryptionDb.schema, dialect, 'encryption_person')
        .addColumn('first_name', 'varchar(255)')
        .addColumn('last_name', 'varchar(255)')
        .addColumn('salary', 'varchar(255)')
        .addColumn('preferences', 'json')
        .execute()
    })
    // const encrypt = (a: any) => ({ __encrypt: true, value: a })
    beforeEach(async () => {

      await encryptionDb
        .insertInto('encryption_person')
        .values([
          {
            first_name: 'Jennifer',
            last_name: 'Aniston',
            salary: new EncryptedValue(1000),
            preferences: json({ disable_emails: true }),
          },
          {
            first_name: 'Arnold',
            last_name: 'Schwarzenegger',
            salary: new EncryptedValue(2000),
            preferences: json({ disable_emails: true }),
          },
        ])
        .execute()
    })

    afterEach(async () => {
      await encryptionDb.deleteFrom('encryption_person').execute()
    })

    after(async () => {
      await encryptionDb.schema.dropTable('encryption_person').ifExists().execute()
      await encryptionDb.destroy()
      await destroyTest(ctx)
    })


    it('should encrypt before insert', async () => {
      const query = encryptionDb.insertInto('encryption_person').values({
        first_name: 'Foo',
        last_name: 'Barson',
        salary: new EncryptedValue(1)})
        
      const encrypted1 = "_encrypted:v1:aaaaaaaaaaaaaaaa:1e23c6c8b6a4910fde7bba5fdf0fa8ca:fe84bdcbafb2b55e16bc2734d6258d1de776"
      testSql(query, dialect, {
        postgres: {
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Foo', 'Barson', encrypted1],
        },
        mysql: {   
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Foo', 'Barson', encrypted1]
        },
        sqlite: {
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Foo', 'Barson', encrypted1],
        }
      })
    })
    it('should encrypt to differnet value with different input', async () => {
      const query = encryptionDb.insertInto('encryption_person').values({
        first_name: 'Foo',
        last_name: 'Barson',
        salary: new EncryptedValue(3)
      })
      const encrypted3 =  "_encrypted:v1:aaaaaaaaaaaaaaaa:8baa95c674c7ad50fcc092f9c40ca41a:fe84bdcbafb2b55e16bc2734d6258d1de774"
 
      testSql(query, dialect, {
        postgres: {
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Foo', 'Barson', encrypted3],
        },
        mysql: {   
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Foo', 'Barson', encrypted3]
        },
        sqlite: {
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Foo', 'Barson', encrypted3],
        }
      })
    })
    it.only('should decrypt when selected', async () => {
      const query = encryptionDb.insertInto('encryption_person').values({
        first_name: 'Dobby',
        last_name: 'Barson',
        salary: new EncryptedValue(3)
      })
      const encrypted3 = "_encrypted:v1:aaaaaaaaaaaaaaaa:8baa95c674c7ad50fcc092f9c40ca41a:fe84bdcbafb2b55e16bc2734d6258d1de774"
 
      testSql(query, dialect, {
        postgres: {
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Dobby', 'Barson', encrypted3],
        },
        mysql: {   
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Dobby', 'Barson', encrypted3]
        },
        sqlite: {
          sql: 'insert into "encryption_person" ("first_name", "last_name", "salary") values ($1, $2, $3)',
          parameters: ['Dobby', 'Barson', encrypted3],
        }
      })
      await query.execute()
      const selected = await encryptionDb
        .selectFrom("encryption_person")
        .select("encryption_person.salary")
        .where("encryption_person.first_name", "=","Dobby")
        .executeTakeFirst()

      expect(selected?.salary).to.eq(3)
    })
  })
}

function json<T>(obj: T): RawBuilder<T> {
  return sql`${JSON.stringify(obj)}`
}
