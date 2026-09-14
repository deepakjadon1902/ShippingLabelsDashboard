#!/usr/bin/env node
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Label } from "../models/Label.js";
import { refreshOneLabel } from "../tracking/index.js";

import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/brajmart_shipping_labels";

const SYNC_ALL_COURIERS = process.argv.includes("--all");
const TARGET_COURIERS = SYNC_ALL_COURIERS
  ? null
  : ["DTDC", "Shree Maruti Courier", "Delhivery"];

async function runSync() {
  console.log("==========================================");
  console.log("🚀 Starting Daily Tracking Sync");
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log(
    `📦 Target Couriers: ${
      TARGET_COURIERS ? TARGET_COURIERS.join(", ") : "All Auto-Track Couriers"
    }`,
  );
  console.log("==========================================");

  let connection;
  try {
    connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(" Connected to MongoDB successfully.");
  } catch (error) {
    console.error("❌ Fatal: Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }

  const query = {
    tracking_id: { $exists: true, $ne: null, $nin: ["", "-"] },
    status: { $nin: ["Delivered", "RTO"] },
  };

  if (TARGET_COURIERS) {
    query.courier_name = { $in: TARGET_COURIERS };
  }

  const stats = {
    processed: 0,
    updated: 0,
    delivered: 0,
    shipped: 0,
    rto: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const labels = await Label.find(query).sort({ created_at: -1 });
    console.log(`📋 Found ${labels.length} active shipment(s) to synchronize.\n`);

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      stats.processed++;
      const prefix = `[${i + 1}/${labels.length}] [${label.courier_name}] ${label.tracking_id}:`;

      try {
        const initialStatus = label.status;
        const result = await refreshOneLabel(label);

        if (result.skipped) {
          stats.skipped++;
          console.log(`${prefix} ⏭️ Skipped (${result.reason})`);
          continue;
        }

        if (result.error) {
          stats.failed++;
          console.log(`${prefix} ⚠️ Tracking notice: ${result.error}`);
        } else {
          console.log(
            `${prefix}  Success (Status: ${result.updatedStatus || label.status}, Provider: ${
              result.provider || result.source
            })`,
          );
        }

        // Tally status distribution
        const currentStatus = label.status;
        if (currentStatus === "Delivered") stats.delivered++;
        else if (currentStatus === "Shipped") stats.shipped++;
        else if (currentStatus === "RTO") stats.rto++;
        else if (currentStatus === "Pending") stats.pending++;

        if (result.statusChanged || initialStatus !== currentStatus) {
          stats.updated++;
          console.log(
            `    ↳ Status transitioned: ${initialStatus} ➔ ${currentStatus}`,
          );
        }
      } catch (itemError) {
        // Individual item failure must not crash the entire sync job
        stats.failed++;
        console.error(`${prefix} ❌ Error updating record:`, itemError.message);
        try {
          label.last_tracking_update = new Date();
          label.last_tracking_error = itemError.message;
          await label.save();
        } catch {
          // ignore secondary save error
        }
      }

      // Upstream rate limit pacing: 2.5s for Shree Maruti Courier, 400ms for others
      const pacingDelayMs = label.courier_name === "Shree Maruti Courier" ? 2500 : 400;
      await new Promise((resolve) => setTimeout(resolve, pacingDelayMs));
    }
  } catch (jobError) {
    console.error("❌ Fatal error during sync batch:", jobError.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();

  console.log("\n==========================================");
  console.log("📊 Sync Summary");
  console.log("==========================================");
  console.log(`Processed: ${stats.processed}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Delivered: ${stats.delivered}`);
  console.log(`Shipped: ${stats.shipped}`);
  console.log(`RTO: ${stats.rto}`);
  console.log(`Pending: ${stats.pending}`);
  console.log(`Failed: ${stats.failed}`);
  if (stats.skipped > 0) {
    console.log(`Skipped: ${stats.skipped}`);
  }
  console.log("==========================================");

  // Exit 0 for successful completion
  process.exit(0);
}

runSync().catch((err) => {
  console.error("Unhandled exception:", err);
  process.exit(1);
});

