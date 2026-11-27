import { ArrowUpRight, Camera as Instagram, Sparkles } from "lucide-react";
import { FacebookIcon } from "./facebook-icon";
import { Heading } from "./ui";
export type PublicStory = {
  id: string;
  customerName: string;
  platform: "Instagram" | "Facebook";
  message: string;
  sourceUrl: string;
};
export function Stories({ stories }: { stories: PublicStory[] }) {
  return (
    <>
      <section className="page-banner">
        <span className="eyebrow">REAL WORDS. REAL SPARKLE.</span>
        <h1>
          Stories of <em>Sparkle</em>
        </h1>
        <p>Feedback shared by our clients after finding their perfect piece.</p>
      </section>
      <section className="section stories-section">
        <Heading
          eyebrow="CLIENT FEEDBACK"
          title="Stories of Sparkle"
          text="Every piece has a story. These are the ones our clients kindly shared with us."
        />
        {stories.length ? (
          <div className="stories-grid">
            {stories.map((story) => (
              <article className="story-card" key={story.id}>
                <Sparkles className="story-mark" size={26} aria-hidden="true" />
                <p className="preserve-lines">“{story.message}”</p>
                <div className="story-footer">
                  <div className="story-person">
                    <span className="story-platform" aria-hidden="true">
                      {story.platform === "Instagram" ? (
                        <Instagram size={18} />
                      ) : (
                        <FacebookIcon size={18} />
                      )}
                    </span>
                    <span>
                      <strong>{story.customerName}</strong>
                      <small>via {story.platform}</small>
                    </span>
                  </div>
                  {story.sourceUrl && (
                    <a
                      href={story.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="story-source"
                    >
                      View original <ArrowUpRight size={15} />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>Stories are coming soon.</h2>
            <p>Check back shortly for feedback from our clients.</p>
          </div>
        )}
      </section>
    </>
  );
}
