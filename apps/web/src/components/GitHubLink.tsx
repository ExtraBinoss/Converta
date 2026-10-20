import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { githubStars, GITHUB_REPOSITORY } from "@/adapters/github";
export function GitHubLink() {
  const { t, i18n } = useTranslation();
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void githubStars(controller.signal).then((count) => {
      if (!controller.signal.aborted) setStars(count);
    });
    return () => controller.abort();
  }, []);
  return (
    <div className="github-reveal">
      <a
        className="github-link"
        href={GITHUB_REPOSITORY}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={stars === null ? "GitHub" : t("githubStars", { count: stars })}
      >
        <span className="github-mark" aria-hidden="true" />
        {stars !== null && (
          <span className="github-count" aria-hidden="true">
            <span>
              <Star size={13} />
              {new Intl.NumberFormat(i18n.language, { notation: "compact" }).format(stars)}
            </span>
          </span>
        )}
      </a>
    </div>
  );
}
