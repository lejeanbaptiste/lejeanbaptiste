import { encoderNameFromMetadata } from './projectMetadata';

describe('encoderNameFromMetadata', () => {
  it('reads the portable TEI encoder identity from project metadata', () => {
    expect(
      encoderNameFromMetadata({
        version: 1,
        fields: { 'titleStmt/principal': '  Ada Lovelace  ' },
        custom: [],
      }),
    ).toBe('Ada Lovelace');
  });

  it('supports the other project metadata schemas and ignores blank values', () => {
    expect(
      encoderNameFromMetadata({
        version: 1,
        fields: {
          'titleStmt/principal': ' ',
          'publicationStmt/distributor': 'Grace Hopper',
          'REVISIONDESC/RESPONSIBILITY': 'Someone Else',
        },
        custom: [],
      }),
    ).toBe('Grace Hopper');
  });
});
