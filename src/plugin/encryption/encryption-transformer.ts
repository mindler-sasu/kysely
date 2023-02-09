import { ColumnDefinitionNode } from '../../operation-node/column-definition-node.js'
import { InsertQueryNode } from '../../operation-node/insert-query-node.js'
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js'
import { RawNode } from '../../operation-node/raw-node.js'
import { SelectQueryNode } from '../../operation-node/select-query-node.js'
import { ValueNode } from '../../operation-node/value-node.js'
import { freeze } from '../../util/object-utils.js'
import { createCipheriv, randomBytes, CipherGCM, createDecipheriv } from "node:crypto"

export type EncryptedPayload =  { p: string, h: { v: number, at: string, iv: string }}
export class EncryptionTransformer extends OperationNodeTransformer {
  #cryptoKey: string
  constructor(cryptoKey:string) {
    super()
    this.#cryptoKey = cryptoKey
  }
  #transformQuery<
    T extends SelectQueryNode | InsertQueryNode | ColumnDefinitionNode,
  >(node: T): T {
    
    
    if(node.kind === 'InsertQueryNode') {
      const newValues = (node.values as any).values.map((currNode: any) => {
        return {
          ...currNode,
          values: currNode.values.map((valueNode: ValueNode | RawNode) => {
            if (valueNode.kind === "RawNode"){
              const encryptedParameters = valueNode.parameters.map((param: any) => {
                if(param.value.__encrypted) {
                  return {...param, value: JSON.stringify(this.encrypt(param.value.value))}
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
      return freeze(newNode)
    }
    if(node.kind === 'SelectQueryNode'){
      console.log((node.selections as any)[0].selection.column)
    }
   return freeze(node)
  }
  decrypt = (encrypted: EncryptedPayload) => {
    const {
      iv,
      at: authTag,
    } = encrypted.h;
    
    const encryptedText = encrypted.p

    const defaultEncoding = "hex";
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(this.#cryptoKey),
      iv
    );

    decipher.setAuthTag(Buffer.from(authTag, defaultEncoding));

    const dc = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "hex")),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(dc.slice(17))

  }
  protected encrypt = (value: unknown) => {
    const iv = randomBytes(16);
    const input = Buffer.from(`${iv.toString("hex")}:${JSON.stringify(value)}`)

    const cipher = createCipheriv("aes-256-gcm", Buffer.from(this.#cryptoKey), iv);

    const encrypted = Buffer.concat([
      cipher.update(input),
      cipher.final(),
    ]).toString("hex");

   
    const authTag = (cipher as CipherGCM).getAuthTag().toString("hex");
    const encryptedPayload = {
      _e: true,
      h: {
        v: 1,
        iv: iv.toString("hex"),
        at: authTag,
      },
      p: encrypted
    }
    return encryptedPayload;
  }

  protected transformInsertQuery(node: InsertQueryNode): InsertQueryNode {
    return super.transformInsertQuery(this.#transformQuery(node))
  }

}
