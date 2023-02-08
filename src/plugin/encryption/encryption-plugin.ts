import { QueryResult } from '../../driver/database-connection.js'
import { Expression } from '../../expression/expression.js'
import { OperationNode } from '../../operation-node/operation-node.js'
import { RawNode } from '../../operation-node/raw-node.js'
import { ValueNode } from '../../operation-node/value-node.js'
import { RootOperationNode } from '../../query-compiler/query-compiler.js'
import { UnknownRow } from '../../util/type-utils.js'
import {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs
} from '../kysely-plugin.js'
import { EncryptionTransformer } from './encryption-transformer.js'

export class EncryptedValue<T> implements Expression<T> {
  #value: T

  constructor(value: T) {
    this.#value = value
  }

  // This is a mandatory getter. You must add it and always return `undefined`.
  // The return type must always be `T | undefined`.
  get expressionType(): T | undefined {
    return undefined
  }

  toOperationNode(): OperationNode {
    // Most of the time you can use the `sql` template tag to build the returned node. 
    // The `sql` template tag takes care of passing the `json` string as a parameter, alongside the sql string, to the DB.
    return RawNode.create(['',''], [ValueNode.create({ __encrypted: true, value: this.#value })])
  }
}
export interface EncryptionPluginOptions {
  /**
   * Which encryption algorithm to use
   */
  algorithm?: "aes-256-gcm"
  cryptoKey?: string
}
type CryptoKey<T> = string
/**
 * A plugin that encrypts values in the database

 */
export class EncryptionPlugin implements KyselyPlugin {

  readonly #encryptionTransformer: EncryptionTransformer
  readonly #cryptoKey: CryptoKey<string>

  constructor(readonly opt: EncryptionPluginOptions = {}) {
    this.#cryptoKey = opt.cryptoKey ?? "a".repeat(32)
    this.#encryptionTransformer = new EncryptionTransformer(this.#cryptoKey)
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.#encryptionTransformer.transformNode(args.node)
  }

  async transformResult(
    args: PluginTransformResultArgs
  ): Promise<QueryResult<UnknownRow>> {
    return args.result
  }

  protected mapRow(row: UnknownRow): UnknownRow {
    return row
  }

}



