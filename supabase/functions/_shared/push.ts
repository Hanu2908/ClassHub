import webpush from "npm:web-push@3.6.7";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: string;
  announcementId?: string;
  actions?: Array<{ action: string; title: string; icon?: string }>;
};

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
) {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    return { ok: false, error: "Missing VAPID keys" };
  }

  try {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@classhub.local",
      vapidPublicKey,
      vapidPrivateKey,
    );

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );

    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Push send failed" };
  }
}
