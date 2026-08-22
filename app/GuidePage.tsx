import { InnerPageLayout } from "./InnerPageLayout";
import {
  GUIDE_BASE_PATH,
  guideIndex,
  guidePageDefinitions,
  type GuidePageKey,
} from "./guide-page-data";
import type { GuideReference } from "./steel-reference";
import { RebarWeightGuide } from "./guides/RebarWeightGuide";
import { BeamWeightGuide } from "./guides/BeamWeightGuide";
import { RibbedVsPlainGuide } from "./guides/RibbedVsPlainGuide";
import { BeamTypesGuide } from "./guides/BeamTypesGuide";
import { UnitsGuide } from "./guides/UnitsGuide";
import { GuideIndexContent } from "./guides/GuideIndexContent";

function GuideContent({
  guide,
  reference,
}: {
  guide: GuidePageKey;
  reference: GuideReference;
}) {
  if (guide === "rebar-weight-chart")
    return <RebarWeightGuide reference={reference} />;
  if (guide === "beam-weight-chart")
    return <BeamWeightGuide reference={reference} />;
  if (guide === "ribbed-vs-plain-rebar")
    return <RibbedVsPlainGuide reference={reference} />;
  if (guide === "ipe-vs-hash-beam")
    return <BeamTypesGuide reference={reference} />;
  return <UnitsGuide reference={reference} />;
}

export type GuidePageProps = {
  /** Undefined renders the /guide/ index. */
  guide?: GuidePageKey;
  reference: GuideReference;
};

export default function GuidePage({ guide, reference }: GuidePageProps) {
  const definition = guide ? guidePageDefinitions[guide] : guideIndex;

  return (
    <InnerPageLayout
      // Must match the <title> the build stamps into the head, or the tab
      // title changes the moment hydration runs.
      documentTitle={definition.seoTitle}
      eyebrow={definition.eyebrow}
      title={definition.title}
      description={definition.description}
      contentClassName="guide-content"
      breadcrumbItems={
        guide
          ? [
              { label: "صفحه اصلی", href: "/" },
              { label: guideIndex.title, href: GUIDE_BASE_PATH },
              { label: definition.title },
            ]
          : [
              { label: "صفحه اصلی", href: "/" },
              { label: guideIndex.title },
            ]
      }
    >
      {guide ? (
        <GuideContent guide={guide} reference={reference} />
      ) : (
        <GuideIndexContent />
      )}
    </InnerPageLayout>
  );
}

