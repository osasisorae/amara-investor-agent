import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REQUIRED_R2_ENV_KEYS = [
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ACCOUNT_ID',
  'R2_ENDPOINT',
  'R2_BUCKET_NAME',
] as const;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: getRequiredEnv('R2_ENDPOINT'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
}

function getBucketName(): string {
  return getRequiredEnv('R2_BUCKET_NAME');
}

export function getR2ConfigStatus(): {
  configured: string[];
  missing: string[];
} {
  const configured: string[] = [];
  const missing: string[] = [];

  for (const key of REQUIRED_R2_ENV_KEYS) {
    if (process.env[key]?.trim()) {
      configured.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    configured,
    missing,
  };
}

export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const client = createR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: filename,
      Body: file,
      ContentType: contentType,
    })
  );

  return filename;
}

export async function getSignedDocumentUrl(filename: string): Promise<string> {
  const client = createR2Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: filename,
    }),
    { expiresIn: 60 * 60 }
  );
}

export async function deleteFile(filename: string): Promise<void> {
  const client = createR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: filename,
    })
  );
}
