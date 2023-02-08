import { ColumnDefinitionNode } from '../../operation-node/column-definition-node.js'
import { InsertQueryNode } from '../../operation-node/insert-query-node.js'
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js'
import { RawNode } from '../../operation-node/raw-node.js'
import { SelectQueryNode } from '../../operation-node/select-query-node.js'
import { ValueNode } from '../../operation-node/value-node.js'
import { freeze } from '../../util/object-utils.js'
import { createCipheriv, randomBytes, CipherGCM } from "crypto"


export class EncryptionTransformer extends OperationNodeTransformer {
  #cryptoKey: string
  constructor(cryptoKey:string) {
    super()
    this.#cryptoKey = cryptoKey
  }
  #transformQuery<
    T extends SelectQueryNode | InsertQueryNode | ColumnDefinitionNode
  >(node: T): T {
    
    // if(node.kind === 'ColumnDefinitionNode' && node.encrypted){
    //   console.log(node)
    // }
    if(node.kind === 'InsertQueryNode') {
      const newValues = (node.values as any).values.map((currNode: any) => {
        return {
          ...currNode,
          values: currNode.values.map((valueNode: ValueNode | RawNode) => {
            if (valueNode.kind === "RawNode"){
              const encryptedParameters = valueNode.parameters.map((param: any) => {
                if(param.value.__encrypted) {
                  return {...param, value: this.encrypt(param.value.value)}
                }
                return param
              })
              return {...valueNode, parameters: encryptedParameters}
            }
            return valueNode
          })
        }
      }, {})
      const newNode = { ...node, values: { ...node.values, values: newValues } }
      // console.log((node.values as any).values[0].values.map((a: any) => a.parameters), newNode.values.values[0].values.map((a: any) => a.parameters))
      return freeze(newNode)
    }
   return freeze(node)
  }

  protected encrypt = (value: unknown) => {
    const input = Buffer.from(JSON.stringify(value)).toString("base64")
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(this.#cryptoKey), iv);
    const encrypted = Buffer.concat([
      cipher.update(input),
      cipher.final(),
    ]).toString("hex");

   
    const authTag = (cipher as CipherGCM).getAuthTag().toString("hex");

    return `_encrypted:v1:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

  protected transformSelectQuery(node: SelectQueryNode): SelectQueryNode {
    return this.#transformQuery(super.transformSelectQuery(node))
  }
  protected transformInsertQuery(node: InsertQueryNode): InsertQueryNode {
    return super.transformInsertQuery(this.#transformQuery(node))
  }
  protected transformColumnDefinition(node: ColumnDefinitionNode): ColumnDefinitionNode {
    return this.#transformQuery(super.transformColumnDefinition(node))
  }
}
