// src/genre/entities/content-genre.entity.ts
import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Content } from './content.entity';
import { Genre } from './genre.entity';

@Entity()
export class ContentGenre {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => Content,
    (content) => content.contentGenres,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'contentId' })
  content: Content;

  @ManyToOne(
    () => Genre,
    (genre) => genre.contentGenres,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'genreId' })
  genre: Genre;
}
