import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoPage } from "@/features/content/components/InfoPage";
import { getInfoPage } from "@/features/content/content.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Privacy Policy · Theme Store" };
}

export default async function PrivacyPage() {
  const page = await getInfoPage("privacy");
  if (!page) notFound();
  return <InfoPage page={page} />;
}
