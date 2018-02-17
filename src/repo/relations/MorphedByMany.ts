import * as _ from '../../support/lodash'
import { Record, NormalizedData } from '../../Data'
import Model from '../../Model'
import { Collection } from '../Query'
import { Fields } from '../Attribute'
import Repo, { Relation as Load } from '../Repo'
import Relation from './Relation'

export type Entity = typeof Model | string

export default class MorphedByMany extends Relation {
  /**
   * The related model.
   */
  related: typeof Model

  /**
   * The pivot model.
   */
  pivot: typeof Model

  /**
   * The field name that conatins id of the related model.
   */
  relatedId: string

  /**
   * The field name that contains id of the parent model.
   */
  id: string

  /**
   * The field name fthat contains type of the parent model.
   */
  type: string

  /**
   * The key name of the parent model.
   */
  parentKey: string

  /**
   * The key name of the related model.
   */
  relatedKey: string

  /**
   * The related record.
   */
  records: Collection

  /**
   * Create a new belongs to instance.
   */
  constructor (
    related: Entity,
    pivot: Entity,
    relatedId: string,
    id: string,
    type: string,
    parentKey: string,
    relatedKey: string,
    records: Collection,
    connection?: string
  ) {
    super()

    this.related = this.model(related, connection)
    this.pivot = this.model(pivot, connection)
    this.relatedId = relatedId
    this.id = id
    this.type = type
    this.parentKey = parentKey
    this.relatedKey = relatedKey
    this.records = records
  }

  /**
   * Load the morph many relationship for the record.
   */
  load (repo: Repo, record: Record, relation: Load): Collection {
    const pivotQuery = new Repo(repo.state, this.pivot.entity, false)

    const relatedItems = pivotQuery.where((rec: any) => {
      return rec[this.relatedId] === record[this.parentKey] && rec[this.type] === relation.name
    }).get()

    if (relatedItems.length === 0) {
      return []
    }

    const relatedIds = _.map(relatedItems, this.id)

    const relatedQuery = new Repo(repo.state, this.related.entity, false)

    relatedQuery.where(this.relatedKey, (v: any) => _.includes(relatedIds, v))

    this.addConstraint(relatedQuery, relation)

    return relatedQuery.get()
  }

  /**
   * Make model instances of the relation.
   */
  make (_parent: Fields): Model[] {
    if (this.records.length === 0) {
      return []
    }

    return this.records.map(record => new this.related(record))
  }

  /**
   * Create pivot records for the given records if needed.
   */
  createPivots (parent: typeof Model, data: NormalizedData): NormalizedData {
    _.forEach(data[parent.entity], (record) => {
      const related = record[this.related.entity]

      if (related.length === 0) {
        return
      }

      this.createPivotRecord(data, record, related)
    })

    return data
  }

  /**
   * Create a pivot record.
   */
  createPivotRecord (data: NormalizedData, record: Record, related: any[]): void {
    _.forEach(related, (id) => {
      const parentId = record[this.parentKey]
      const pivotKey = `${id}_${parentId}_${this.related.entity}`

      data[this.pivot.entity] = {
        ...data[this.pivot.entity],

        [pivotKey]: {
          $id: pivotKey,
          [this.relatedId]: parentId,
          [this.id]: id,
          [this.type]: this.related.entity
        }
      }
    })
  }
}
