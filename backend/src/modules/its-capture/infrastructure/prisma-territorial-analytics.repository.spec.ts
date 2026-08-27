import { deriveTerritorialCentroids } from './prisma-territorial-analytics.repository';

describe('deriveTerritorialCentroids', () => {
  const entities = [
    { id: 'region-a', code: '01', name: 'Región A' },
    { id: 'region-b', code: '02', name: 'Región B' },
  ];

  it('derives a regional centroid from real facility coordinates', () => {
    const result = deriveTerritorialCentroids('REGION', entities, [
      {
        latitude: '15.800000',
        longitude: '-87.900000',
        coordinatesValidated: true,
        municipality: { id: 'municipality-a', regionId: 'region-a' },
      },
      {
        latitude: '16.000000',
        longitude: '-88.100000',
        coordinatesValidated: false,
        municipality: { id: 'municipality-b', regionId: 'region-a' },
      },
    ]);

    expect(result[0]).toMatchObject({
      latitude: 15.9,
      longitude: -88,
      coordinatesValidated: false,
    });
    expect(result[1]).not.toHaveProperty('latitude');
  });

  it('groups municipal points independently and ignores invalid coordinates', () => {
    const municipalities = [
      { id: 'municipality-a', code: '0101', name: 'Municipio A' },
      { id: 'municipality-b', code: '0102', name: 'Municipio B' },
    ];
    const result = deriveTerritorialCentroids('MUNICIPIO', municipalities, [
      {
        latitude: 15.75,
        longitude: -87.95,
        coordinatesValidated: true,
        municipality: { id: 'municipality-a', regionId: 'region-a' },
      },
      {
        latitude: 120,
        longitude: -87.8,
        coordinatesValidated: true,
        municipality: { id: 'municipality-b', regionId: 'region-a' },
      },
    ]);

    expect(result[0]).toMatchObject({
      latitude: 15.75,
      longitude: -87.95,
      coordinatesValidated: true,
    });
    expect(result[1]).not.toHaveProperty('latitude');
  });
});
