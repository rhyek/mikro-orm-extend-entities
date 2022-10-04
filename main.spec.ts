import {
  Entity,
  ManyToOne,
  MetadataError,
  MikroORM,
  OptionalProps,
  PrimaryKey,
  Property,
  wrap,
  TableNotFoundException,
} from '@mikro-orm/core';
import { AbstractSqlDriver } from '@mikro-orm/mysql';
import { randomUUID } from 'crypto';

@Entity({ tableName: 'company' })
class BaseCompanyEntity {
  @PrimaryKey()
  id!: string;

  @Property()
  name!: string;
}

@Entity({ tableName: 'user' })
class BaseUserEntity {
  @PrimaryKey()
  id!: string;

  @Property()
  firstName!: string;

  @Property()
  lastName!: string;

  @ManyToOne(() => BaseCompanyEntity, { nullable: true })
  company?: BaseCompanyEntity | null;
}

function initMikroOrm(entities: any): Promise<MikroORM<AbstractSqlDriver>> {
  return MikroORM.init({
    type: 'mysql',
    host: 'localhost',
    port: 8777,
    user: 'leadgogo',
    password: 'leadgogo',
    dbName: 'leadgogo',
    allowGlobalContext: true,
    entities,
  });
}

describe('mikro orm extend entities', () => {
  let orm: MikroORM<AbstractSqlDriver>;
  beforeEach(async () => {
    orm = await initMikroOrm([BaseUserEntity]);
    await orm.schema.dropSchema();
    await orm.schema.createSchema();
    await orm.close();
  });
  afterEach(async () => {
    await orm?.close();
  });
  test('with base entity', async () => {
    orm = await initMikroOrm([BaseUserEntity]);
    const user = orm.em.create(BaseUserEntity, {
      id: randomUUID(),
      firstName: 'tony',
      lastName: 'soprano',
      company: orm.em.create(BaseCompanyEntity, {
        id: randomUUID(),
        name: 'coca cola',
      }),
    });
    await orm.em.persistAndFlush(user);
    const { id } = user;
    await orm.close();
    orm = await initMikroOrm([BaseUserEntity]);
    const found = await orm.em.findOne(
      BaseUserEntity,
      { id },
      {
        populate: ['company'],
      }
    );
    expect(found).toMatchObject({
      id,
      firstName: 'tony',
      lastName: 'soprano',
      company: {
        name: 'coca cola',
      },
    });
    await orm.close();
  });
  test('with extending entity and not using decorator fails', async () => {
    class UserEntity extends BaseUserEntity {
      [OptionalProps]?: 'fullName';

      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      }
    }

    let orm = await initMikroOrm([UserEntity]);
    try {
      const user = orm.em.create(UserEntity, {
        id: randomUUID(),
        firstName: 'tony',
        lastName: 'soprano',
        company: orm.em.create(BaseCompanyEntity, {
          id: randomUUID(),
          name: 'coca cola',
        }),
      });
    } catch (error: any) {
      expect(error instanceof MetadataError).toBeTruthy();
      expect(error.message).toEqual('Metadata for entity UserEntity not found');
    }
    await orm.close();
  });
  test('with extending entity and using decorator without specifying table name fails', async () => {
    @Entity()
    class UserEntity extends BaseUserEntity {
      [OptionalProps]?: 'fullName';

      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      }
    }

    let orm = await initMikroOrm([UserEntity]);
    const user = orm.em.create(UserEntity, {
      id: randomUUID(),
      firstName: 'tony',
      lastName: 'soprano',
      company: orm.em.create(BaseCompanyEntity, {
        id: randomUUID(),
        name: 'coca cola',
      }),
    });
    try {
      await orm.em.persistAndFlush(user);
    } catch (error) {
      expect(error instanceof TableNotFoundException).toBeTruthy();
    }
    await orm.close();
  });
  test('with extending entity and using decorator with same table name succeeds', async () => {
    @Entity({ tableName: 'user' })
    class UserEntity extends BaseUserEntity {
      [OptionalProps]?: 'fullName';

      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      }
    }

    let orm = await initMikroOrm([UserEntity]);
    const user = orm.em.create(UserEntity, {
      id: randomUUID(),
      firstName: 'tony',
      lastName: 'soprano',
      company: orm.em.create(BaseCompanyEntity, {
        id: randomUUID(),
        name: 'coca cola',
      }),
    });
    await orm.em.persistAndFlush(user);
    const { id } = user;
    await orm.close();
    orm = await initMikroOrm([UserEntity]);
    const found = await orm.em.findOne(
      UserEntity,
      { id },
      {
        populate: ['company'],
      }
    );
    expect(found).toMatchObject({
      id,
      firstName: 'tony',
      lastName: 'soprano',
      fullName: 'tony soprano',
      company: {
        name: 'coca cola',
      },
    });
    await orm.close();
  });
  test('with extending entity and using decorator with same table name with additional property succeeds', async () => {
    @Entity({ tableName: 'user' })
    class UserEntity extends BaseUserEntity {
      [OptionalProps]?: 'fullName';

      @Property({ formula: "CONCAT(first_name, ' ', last_name)" })
      fullName!: string;
    }

    let orm = await initMikroOrm([UserEntity]);
    const user = orm.em.create(UserEntity, {
      id: randomUUID(),
      firstName: 'tony',
      lastName: 'soprano',
      company: orm.em.create(BaseCompanyEntity, {
        id: randomUUID(),
        name: 'coca cola',
      }),
    });
    await orm.em.persistAndFlush(user);
    const { id } = user;
    await orm.close();
    orm = await initMikroOrm([UserEntity]);
    const found = await orm.em.findOne(
      UserEntity,
      { id },
      {
        populate: ['company'],
      }
    );
    expect(wrap(found?.company).isInitialized()).toEqual(true);
    expect(found).toMatchObject({
      id,
      firstName: 'tony',
      lastName: 'soprano',
      fullName: 'tony soprano',
      company: {
        name: 'coca cola',
      },
    });
    await orm.close();
  });
  test('using entity manager with extending entity and using decorator with same table name with additional property in relation fails', async () => {
    @Entity({ tableName: 'company' })
    class CompanyEntity extends BaseCompanyEntity {
      [OptionalProps]?: 'nameUpper';

      @Property({ formula: 'UPPER(name)' })
      nameUpper!: string;
    }

    @Entity({ tableName: 'user' })
    class UserEntity extends BaseUserEntity {
      [OptionalProps]?: 'fullName';

      @Property({ formula: "CONCAT(first_name, ' ', last_name)" })
      fullName!: string;

      @ManyToOne(() => CompanyEntity, { nullable: true })
      company?: CompanyEntity | null;
    }

    let orm = await initMikroOrm([UserEntity]);
    const user = orm.em.create(UserEntity, {
      id: randomUUID(),
      firstName: 'tony',
      lastName: 'soprano',
      company: orm.em.create(CompanyEntity, {
        id: randomUUID(),
        name: 'coca cola',
      }),
    });
    await orm.em.persistAndFlush(user);
    const { id } = user;
    await orm.close();
    orm = await initMikroOrm([UserEntity]);
    const found = await orm.em.findOne(
      UserEntity,
      { id },
      {
        populate: ['company'],
      }
    );
    const wrappedCompany = wrap(found?.company);
    expect(wrappedCompany.isInitialized()).toEqual(true);
    expect(found).toMatchObject({
      id,
      firstName: 'tony',
      lastName: 'soprano',
      fullName: 'tony soprano',
      company: {
        name: 'coca cola',
        nameUpper: 'COCA COLA',
      },
    });
    await orm.close();
  });
  test('using query builder with extending entity and using decorator with same table name with additional property in relation fails', async () => {
    @Entity({ tableName: 'company' })
    class CompanyEntity extends BaseCompanyEntity {
      [OptionalProps]?: 'nameUpper';

      @Property({ formula: 'UPPER(name)' })
      nameUpper!: string;
    }

    @Entity({ tableName: 'user' })
    class UserEntity extends BaseUserEntity {
      [OptionalProps]?: 'fullName';

      @Property({ formula: "CONCAT(first_name, ' ', last_name)" })
      fullName!: string;

      @ManyToOne(() => CompanyEntity, { nullable: true })
      company?: CompanyEntity | null;
    }

    let orm = await initMikroOrm([UserEntity]);
    const user = orm.em.create(UserEntity, {
      id: randomUUID(),
      firstName: 'tony',
      lastName: 'soprano',
      company: orm.em.create(CompanyEntity, {
        id: randomUUID(),
        name: 'coca cola',
      }),
    });
    await orm.em.persistAndFlush(user);
    const { id } = user;
    await orm.close();
    orm = await initMikroOrm([UserEntity]);
    const found = await orm.em
      .createQueryBuilder(UserEntity)
      .joinAndSelect('company', 'c')
      .where({
        id,
      })
      .getSingleResult();
    const wrappedCompany = wrap(found?.company);
    expect(wrappedCompany.isInitialized()).toEqual(true);
    expect(found).toMatchObject({
      id,
      firstName: 'tony',
      lastName: 'soprano',
      fullName: 'tony soprano',
      company: {
        name: 'coca cola',
        nameUpper: 'COCA COLA',
      },
    });
    await orm.close();
  });
});
