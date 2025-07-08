// src/genre/entities/genre.entity.ts

import { SourceType } from 'src/common/enums/source-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentType } from '../../../common/enums/content-type.enum';
import { ContentGenre } from './content-genre.entity';

@Entity()
@Index(['externalId', 'source', 'type'], { unique: true })
export class Genre {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  externalId: string;

  @Column({ type: 'enum', enum: SourceType })
  source: SourceType;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ContentType })
  type: ContentType;

  @OneToMany(
    () => ContentGenre,
    (cg) => cg.genre,
  )
  contentGenres: ContentGenre[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
