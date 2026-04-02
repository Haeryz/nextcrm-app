import { S3Client } from "@aws-sdk/client-s3";
import { areExternalApisDisabled } from "@/lib/external-apis";

const minioEndpoint = process.env.MINIO_ENDPOINT;
const minioAccessKey = process.env.MINIO_ACCESS_KEY;
const minioSecretKey = process.env.MINIO_SECRET_KEY;
const minioBucket = process.env.MINIO_BUCKET;

const hasMinioConfig =
  Boolean(minioEndpoint) &&
  Boolean(minioAccessKey) &&
  Boolean(minioSecretKey) &&
  Boolean(minioBucket);

export const isMinioEnabled = !areExternalApisDisabled() && hasMinioConfig;

export const minioClient = isMinioEnabled
  ? new S3Client({
      endpoint: minioEndpoint,
      region: "us-east-1", // MinIO requires a region value; actual value doesn't matter
      credentials: {
        accessKeyId: minioAccessKey as string,
        secretAccessKey: minioSecretKey as string,
      },
      forcePathStyle: true, // REQUIRED for MinIO — without this, SDK uses virtual-hosted-style which breaks
    })
  : null;

export const MINIO_BUCKET = minioBucket ?? "";
export const MINIO_PUBLIC_URL = process.env.NEXT_PUBLIC_MINIO_ENDPOINT ?? "";
