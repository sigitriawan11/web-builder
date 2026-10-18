import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ApiEnv } from "../config/env";

// ARCHITECTURE §9.9: upload langsung ke object storage lewat presigned PUT (key prefix, Content-Type & Content-Length
// dibatasi oleh tanda tangan). Port kecil agar service bisa diuji tanpa S3 sungguhan (fake di test).

export interface AssetStorage {
  readonly uploadsBucket: string;
  readonly assetsBucket: string;
  /** URL presigned PUT; browser wajib mengirim `Content-Type` & `Content-Length` yang sama persis. */
  presignUpload(input: { key: string; contentType: string; contentLength: number }): Promise<string>;
  /** URL presigned GET untuk menyajikan varian aset (bucket assets) ke editor (ED-161). */
  presignDownload(input: { key: string }): Promise<string>;
}

// Presigned PUT berumur pendek (ED/ARCH: upload harus segera). 5 menit cukup untuk mulai upload.
const PRESIGN_EXPIRES_S = 300;

export function createAssetStorage(env: ApiEnv): AssetStorage {
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  return {
    uploadsBucket: env.S3_BUCKET_UPLOADS,
    assetsBucket: env.S3_BUCKET_ASSETS,
    presignUpload: ({ key, contentType, contentLength }) =>
      getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: env.S3_BUCKET_UPLOADS,
          Key: key,
          ContentType: contentType,
          ContentLength: contentLength,
        }),
        { expiresIn: PRESIGN_EXPIRES_S },
      ),
    presignDownload: ({ key }) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket: env.S3_BUCKET_ASSETS, Key: key }), {
        expiresIn: PRESIGN_EXPIRES_S,
      }),
  };
}
