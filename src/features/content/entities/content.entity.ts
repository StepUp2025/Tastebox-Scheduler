import { ContentType } from 'src/common/enums/content-type.enum';
import { SourceType } from 'src/common/enums/source-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { ContentGenre } from './content-genre.entity';
import { Genre } from './genre.entity';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'dtype' } })
export abstract class Content {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ContentType })
  type: ContentType;

  @Column({ type: 'enum', enum: SourceType })
  source: SourceType;

  @Column({ type: 'varchar', length: 255 })
  externalId: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'boolean', default: false })
  hasKoreanTitle: boolean;

  @OneToMany(
    () => ContentGenre,
    (cg) => cg.content,
  )
  contentGenres: ContentGenre[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public setGenres(genres: Genre[]): void {
    this.contentGenres = genres.map((genre) => {
      const cg = new ContentGenre();
      cg.content = this;
      cg.genre = genre;
      return cg;
    });
  }

  abstract get displayTitle(): string;
}
