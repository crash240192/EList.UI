export interface EventsSearchRequest{
    startTime: Date | null,
    endTime: Date | null,
    latitude: number | null,
    longitude: number | null,
    locationRange: number | null,
    types: string[] | null,
    categories: string[] | null,
    organizatorId: string | null,
    participantId: string | null,
    price: number | null,
    allowedGender: string | null,
    pageIndex: number | null,
    pageSize: number | null
}