// src/lib/admin/growth-queries.ts (ADR-244, Growth Engine)
// Data access for the founder Growth surface: content/experiment lineage rows
// (growth_content, migration 31) and the social-connection status board.
// Deliberately small — review state + lineage, not a CMS.
import { createServerClient } from '@/lib/database';

export interface GrowthContentRow {
  content_id: string;
  experiment_id: string;
  channel: string;
  creative_variant: string | null;
  hook: string | null;
  hook_family: string | null;
  title: string | null;
  why_now: string | null;
  evidence: Record<string, unknown> | null;
  landing_url: string | null;
  utm: Record<string, unknown> | null;
  video_url: string | null;
  status: string;
  founder_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchGrowthContent(): Promise<GrowthContentRow[]> {
  const supabase = createServerClient() as unknown as { from: (t: string) => any };
  const { data, error } = await supabase
    .from('growth_content')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as GrowthContentRow[];
}

export const GROWTH_STATUS_LABEL_AR: Record<string, string> = {
  draft: 'مسودة',
  ready_for_review: 'جاهز للمراجعة',
  approved: 'معتمد',
  changes_requested: 'مطلوب تعديل',
  rejected: 'مرفوض',
  published: 'منشور',
};

// Social connection truth board — updated from direct inspection, never invented.
// (Gate B, 2026-08-13: both accounts inspected live from the public web.)
export const SOCIAL_STATUS = [
  {
    channel: 'TikTok',
    handle: '@tawveeri',
    exists: true,
    verifiedAt: '2026-08-13',
    state: 'حساب فعلي منشور فيه فيديو واحد (2026-08-06) حقق ~2,250 مشاهدة و~664 إعجاب — وتزامن مع أعلى أيام زيارات حقيقية للمنصة (65-75 جلسة/يوم في 8-10 أغسطس).',
    apiState: 'غير موصول. النشر الآلي يتطلب TikTok for Business + Content Posting API (وضع المسودّة يعمل بدون تدقيق التطبيق). التحليلات التفصيلية (نسبة الإكمال، مصادر المشاهدة) تظهر فقط داخل TikTok Studio.',
    blocker: 'ربط الحساب يحتاج تسجيل دخول المؤسس (OAuth) — لا نطلب كلمات مرور.',
  },
  {
    channel: 'X',
    handle: '@Tawveeri',
    exists: true,
    verifiedAt: '2026-08-13',
    state: 'حساب موثّق (Premium) منذ مارس 2026، فيه 31 منشورًا و15 متابعًا. آخر منشور (11 أغسطس) حقق ~26 مشاهدة — وصول شبه معدوم رغم التوثيق.',
    apiState: 'واجهة X البرمجية لم تعد مجانية: النشر بالدفع لكل منشور (0.20$ للمنشور الذي يحتوي رابطًا). النشر اليدوي مجاني.',
    blocker: 'لا يوصى بشراء API الآن — النشر اليدوي كافٍ لهذه المرحلة.',
  },
] as const;
