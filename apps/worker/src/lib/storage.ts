import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { WorkerEnv } from "../config/env";

// Akses object storage untuk processor image-processing (ARCHITECTURE §9.9): unduh file mentah dari bucket `uploads`,
// unggah varian ke bucket `assets`. Port kecil agar processor bisa diuji dengan fake.

export interface ImageStorage {
  readonly uploadsBucket: string;
  readonly assetsBucket: string;
  getObject(bucket: string, key: string): Promise<Buffer>;
  putObject(input: { bucket: string; key: string; body: Buffer; contentType: string }): Promise<void>;
}

export function createImageStorage(env: WorkerEnv): ImageStorage {
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  return {
    uploadsBucket: env.S3_BUCKET_UPLOADS,
    assetsBucket: env.S3_BUCKET_ASSETS,
    async getObject(bucket, key) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!response.Body) throw new Error(`objek kosong: ${bucket}/${key}`);
      return Buffer.from(await response.Body.transformToByteArray());
    },
    async putObject({ bucket, key, body, contentType }) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
  };
}
