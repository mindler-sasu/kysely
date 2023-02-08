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
        plugins: [new EncryptionPlugin()],
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

   
      it('should have created the table and its columns in snake_case', async () => {
        const result = await sql<any>`select * from encryption_person`.execute(
          ctx.db
        )

        expect(result.rows).to.have.length(2)
        expect(result.rows[0].id).to.be.a('number')
        expect(result.rows[0].first_name).to.be.a('string')
        expect(result.rows[0].last_name).to.be.a('string')
      })
    

    it('should convert a select query between encryptionCase and snake_case', async () => {
      const query = encryptionDb.insertInto('encryption_person').values({
        first_name: 'Foo',
        last_name: 'Barson',
        salary: new EncryptedValue(1)})
      
      const encrypted1 = "_encrypted:v1:aaaaaaaaaaaaaaaa:713fb2bab9cbf78575e662b4fda1f42b:d2b4e197"
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
    it('should convert a select query between encryptionCase and snake_case', async () => {
      const query = encryptionDb.insertInto('encryption_person').values({
        first_name: 'Foo',
        last_name: 'Barson',
        salary: new EncryptedValue(3)
      })
      const encrypted3 = "_encrypted:v1:aaaaaaaaaaaaaaaa:4d317745d95d76963999913f60942c56:d292e197"
 
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
  })
}

function json<T>(obj: T): RawBuilder<T> {
  return sql`${JSON.stringify(obj)}`
}
