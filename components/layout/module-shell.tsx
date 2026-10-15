import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { navigation, type ModuleSlug } from "@/config/navigation";
import { PageShell, type PageVariant } from "./page-shell";
import { PageHeader } from "./page-header";
import { EmptyState, Badge } from "@/components/ui/display";
export function ModuleShell({ slug }: { slug: ModuleSlug }) {
  const item = navigation.find((n) => n.slug === slug)!;
  return (
    <PageShell
      variant={
        (
          {
            inbox: "workspace",
            orders: "data",
            products: "data",
            customers: "data",
            payments: "data",
            settings: "settings",
            website: "editor",
            analytics: "analytics",
            ads: "analytics",
          } as Partial<Record<ModuleSlug, PageVariant>>
        )[slug] ?? "standard"
      }
    >
      <PageHeader
        title={item.label}
        description={item.description}
        eyebrow={
          <span>
            My shop <span className="breadcrumb-separator">/</span> {item.label}
          </span>
        }
        actions={
          <>
            <Link href="/dashboard" className="button button-secondary">
              Overview
            </Link>
            <Link href={`/${item.next}`} className="button button-primary">
              {item.action}
              <ArrowUpRight size={16} />
            </Link>
          </>
        }
      />
      <div className="module-panel">
        <div className="panel-heading">
          <div className="inline">
            <item.icon size={18} />
            <h2>{item.label} workspace</h2>
          </div>
          <Badge>Not set up</Badge>
        </div>
        <EmptyState
          icon={<item.icon size={30} strokeWidth={1.5} />}
          title={item.empty}
          description={item.detail}
          action={
            <Link className="button button-secondary" href={`/${item.next}`}>
              {item.action}
              <ArrowRight size={16} />
            </Link>
          }
        />
        <div className="module-note">
          <ShieldCheck size={16} />
          <span>
            This is a workspace preview. No live data or business actions are
            connected.
          </span>
        </div>
      </div>
      <div className="quiet-note">
        <Sparkles size={18} />
        <p>
          Connected by design. Products, conversations and orders will work from
          the same approved information.
        </p>
      </div>
    </PageShell>
  );
}
