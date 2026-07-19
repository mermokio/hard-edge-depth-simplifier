export type DepthImage = {
  width: number;
  height: number;
  depth: Float32Array;
  valid: Uint8Array;
  name?: string;
};

export type Parameters = {
  minimumScale: number;
  depthGeometryScale: number;
  smoothingSigma: number;
  depthJumpThreshold: number;
  normalJumpThresholdDeg: number;
  hardnessWindow: number;
  centralBand: number;
  minimumConcentration: number;
  flatnessAngleDeg: number;
  concentrationExponent: number;
  minimumBoundaryLengthFactor: number;
  microRegionSize: number;
  interfaceHardCoverage: number;
  minimumSideSupportFraction: number;
  minimumDiameterFactor: number;
  minimumAreaFactor: number;
  mergeNormalWeight: number;
  mergeDepthWeight: number;
  maximumPlaneSlope: number;
  maximumDimension: number;
  boundaryOpacity: number;
  whiteIsNear: boolean;
  boundedReconstruction: boolean;
};

export type RegionStat = {
  id: number;
  area: number;
  perimeter: number;
  diameter: number;
  meanDepth: number;
  meanOutputDepth: number;
  meanDepthError: number;
  meanNormal: [number, number, number];
  slope: [number, number];
  kind: "flat" | "gradient";
  rmse: number;
  maxResidual: number;
  sourceRegions: number;
  scaleStatus: "passes" | "violation";
  slopeClamped: boolean;
};

export type ScaleAudit = {
  minimumScale: number;
  minimumEdgeLength: number;
  minimumRegionDiameter: number;
  minimumRegionArea: number;
  rawComponents: number;
  microRegions: number;
  agglomerationMerges: number;
  agglomerationPasses: number;
  removedShortComponents: number;
  removedUnsupportedLinks: number;
  provisionalRegions: number;
  belowScaleRegions: number;
  mergeOperations: number;
  finalRegions: number;
  finalViolations: number;
  converged: boolean;
  iterations: number;
};

export type PipelineResult = {
  width: number;
  height: number;
  depth: Float32Array;
  valid: Uint8Array;
  smoothed: Float32Array;
  normals: Float32Array;
  depthChangeH: Float32Array;
  depthChangeV: Float32Array;
  normalChangeH: Float32Array;
  normalChangeV: Float32Array;
  combinedH: Float32Array;
  combinedV: Float32Array;
  concentrationH: Float32Array;
  concentrationV: Float32Array;
  rawH: Uint8Array;
  rawV: Uint8Array;
  retainedH: Uint8Array;
  retainedV: Uint8Array;
  removedShortH: Uint8Array;
  removedShortV: Uint8Array;
  removedSupportH: Uint8Array;
  removedSupportV: Uint8Array;
  supportH: Float32Array;
  supportV: Float32Array;
  initialLabels: Int32Array;
  belowScaleMask: Uint8Array;
  mergeTargets: Int32Array;
  finalLabels: Int32Array;
  meanNormalMap: Float32Array;
  reconstruction: Float32Array;
  unclippedReconstruction: Float32Array;
  outOfRange: Uint8Array;
  residual: Float32Array;
  absResidual: Float32Array;
  stats: RegionStat[];
  audit: ScaleAudit;
  timings: Record<string, number>;
  totalMs: number;
};

export const DEFAULT_PARAMETERS: Parameters = {
  minimumScale: 24,
  depthGeometryScale: 1,
  smoothingSigma: 1,
  depthJumpThreshold: 0.04,
  normalJumpThresholdDeg: 15,
  hardnessWindow: 6,
  centralBand: 1,
  minimumConcentration: 0.6,
  flatnessAngleDeg: 2,
  concentrationExponent: 1,
  minimumBoundaryLengthFactor: 1,
  microRegionSize: 16,
  interfaceHardCoverage: 0.1,
  minimumSideSupportFraction: 0.18,
  minimumDiameterFactor: 1,
  minimumAreaFactor: 0.35,
  mergeNormalWeight: 1,
  mergeDepthWeight: 1,
  maximumPlaneSlope: 4,
  maximumDimension: 640,
  boundaryOpacity: 0.8,
  whiteIsNear: false,
  boundedReconstruction: true,
};

export const ALGORITHM_VERSION = "1.1.0";
