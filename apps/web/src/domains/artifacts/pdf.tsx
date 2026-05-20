/* @jsxImportSource react */
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, fontFamily: "Helvetica" },
  header: {
    color: "#0f3a8a",
    fontSize: 22,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  sub: { color: "#6b7280", marginBottom: 16 },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: "white",
    fontSize: 10,
    backgroundColor: "#0f3a8a",
  },
  kpiRow: { flexDirection: "row", gap: 12, marginVertical: 12 },
  kpiBox: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e4e7eb",
  },
  label: {
    color: "#6b7280",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  value: {
    fontSize: 16,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    color: "#374151",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  body: { lineHeight: 1.5 },
  footer: { marginTop: 36, color: "#9ca3af", fontSize: 9 },
});

function formatUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function formatHours(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} hrs`;
}

export async function renderShowcasePdf(args: {
  title: string;
  problemStatement: string;
  tier: string;
  status: string;
  businessUnit: string;
  champion: string;
  implementationDate: string | null;
  annualSavedUsd: number;
  annualSavedHours: number;
  annualQualityUsd: number;
}): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>{args.title}</Text>
        <Text style={styles.sub}>
          {args.businessUnit} · Tier {args.tier} · Champion {args.champion}
          {args.implementationDate
            ? ` · Live since ${args.implementationDate}`
            : ""}
        </Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.label}>Annual savings</Text>
            <Text style={styles.value}>{formatUsd(args.annualSavedUsd)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.label}>Annual hours saved</Text>
            <Text style={styles.value}>{formatHours(args.annualSavedHours)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.label}>Quality value</Text>
            <Text style={styles.value}>{formatUsd(args.annualQualityUsd)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>The challenge</Text>
        <Text style={styles.body}>{args.problemStatement || "—"}</Text>

        <Text style={styles.sectionTitle}>The solution</Text>
        <Text style={styles.body}>
          An automated workflow built under the AI Champions program. See the
          platform for full ROI breakdown, IT governance assessment, UAT log,
          and source artifacts.
        </Text>

        <Text style={styles.footer}>
          Generated from the AI Champions Platform · Have an idea like this?
          Submit it via the Intake form.
        </Text>
      </Page>
    </Document>
  );

  const stream = await pdf(doc).toBuffer();
  return await streamToBuffer(stream);
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
