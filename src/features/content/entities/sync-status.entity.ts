import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class SyncStatus {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  key: string;

  @Column({ type: 'varchar', length: 100 })
  value: string;
}
