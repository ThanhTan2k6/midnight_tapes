import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Thiếu biến môi trường Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)."
    );
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2Client;
}

function getBucketName(): string {
  return process.env.R2_BUCKET_NAME || "midnight-tapes-audio";
}

/**
 * Sinh Presigned PUT URL có hiệu lực 5 phút để trình duyệt upload audio trực tiếp lên R2.
 */
export async function createAudioPresignedUploadUrl(params: {
  objectKey: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: params.objectKey,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });

  return getSignedUrl(client, command, { expiresIn: 300 });
}

/**
 * Lấy URL phát audio (ưu tiên R2_PUBLIC_CDN_URL, fallback sang Presigned GET URL 1 giờ).
 */
export async function resolveAudioPlaybackUrl(objectKey: string): Promise<string> {
  const cdnBase = process.env.R2_PUBLIC_CDN_URL?.replace(/\/+$/, "");
  if (cdnBase) {
    return `${cdnBase}/${objectKey}`;
  }

  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: objectKey,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/**
 * Tải binary audio từ R2 để gửi vào pipeline AI Moderation.
 */
export async function fetchAudioBytesFromR2(objectKey: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
} | null> {
  try {
    const client = getR2Client();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
      })
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return {
      bytes,
      contentType: res.ContentType || "audio/webm",
    };
  } catch {
    return null;
  }
}

/**
 * Xóa vật lý hàng loạt object audio trên R2 (tối đa 1000 keys/lần theo chuẩn S3).
 */
export async function deleteAudioObjects(objectKeys: string[]): Promise<number> {
  if (objectKeys.length === 0) return 0;

  const client = getR2Client();
  let deletedCount = 0;

  for (let i = 0; i < objectKeys.length; i += 1000) {
    const batch = objectKeys.slice(i, i + 1000);
    const res = await client.send(
      new DeleteObjectsCommand({
        Bucket: getBucketName(),
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
    deletedCount += batch.length - (res.Errors?.length ?? 0);
  }

  return deletedCount;
}
