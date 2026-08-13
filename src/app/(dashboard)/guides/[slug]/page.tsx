import { notFound } from "next/navigation";
import { GuideLayout, GuideNote, GuideSection, GuideSteps } from "@/components/guides/guide-layout";
import { GUIDE_CONTENT } from "@/lib/guide-content";
import { getGuide } from "@/lib/guides";

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const content = GUIDE_CONTENT[guide.slug];

  return (
    <GuideLayout guide={guide}>
      {content.sections.map((section) => (
        <GuideSection key={section.title} title={section.title} description={section.description}>
          {section.body?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {section.steps && <GuideSteps steps={section.steps} />}
          {section.note && <GuideNote>{section.note}</GuideNote>}
        </GuideSection>
      ))}
    </GuideLayout>
  );
}
