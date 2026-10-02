export interface BookMergeRequest {
  sourceBookIds: number[];
}

export interface BookMergeResult {
  targetBookId: number;
  mergedSourceBookIds: number[];
  movedFileCount: number;
}
