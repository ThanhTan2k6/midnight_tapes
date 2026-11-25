import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

/**
 * Sinh Presigned PUT URL có hiệu lực 5 phút để trình duyệt upload audio trực tiếp lên R2.
 */
export async function createAudioPresignedUploadUrl(params: {
  objectKey: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME || "midnight-tapes-audio";
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.objectKey,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });

  return getSignedUrl(client, command, { expiresIn: 300 });
}
