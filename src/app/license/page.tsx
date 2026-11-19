import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoPage } from "@/features/content/components/InfoPage";
import { getInfoPage } from "@/features/content/content.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "License · Theme Store" };
}

export default async function LicensePage() {
  const page = await getInfoPage("license");
  if (!page) notFound();
  return <InfoPage page={page} />;
}
