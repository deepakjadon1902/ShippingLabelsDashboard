import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import type { Label } from "@/lib/labels";
import { getQrPayload } from "@/lib/labels";

interface Props {
  label: Label;
  size?: "compact" | "full";
}

export function ShippingLabel({ label, size = "compact" }: Props) {
  const isCompact = size === "compact";
  const qrSize = isCompact ? 84 : 132;
  const barcodeHeight = isCompact ? 40 : 62;
  const barcodeWidth = isCompact ? 1.5 : 2.2;
  const barcodeFontSize = isCompact ? 11 : 15;

  const trackingForBarcode = (label.tracking_id || "").trim();
  const canRenderBarcode = trackingForBarcode.length > 0 && trackingForBarcode !== "—";

  return (
    <div
      className={
        (isCompact
          ? "print-label text-black bg-white text-[11px] leading-tight p-2.5"
          : "print-label-full text-black bg-white text-base leading-snug p-5") +
        " border border-dashed border-black flex flex-col h-full w-full"
      }
      style={{
        fontFamily: "'Outfit', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontFeatureSettings: "'tnum' 1, 'cv11' 1",
      }}
    >
      <div
        className={
          "border-b-2 border-black pb-1 mb-2 font-black tracking-[0.25em] text-center " +
          (isCompact ? "text-sm" : "text-2xl")
        }
      >
        PARCEL LABEL
      </div>

      {/* Top: receiver on the left, QR neatly filling the right corner */}
      <div className="flex gap-3 min-h-0">
        <div className="flex-1 min-w-0">
          <div
            className={
              "font-semibold tracking-wider " +
              (isCompact ? "text-[10px]" : "text-sm") +
              " uppercase text-black/70"
            }
          >
            To
          </div>
          <div className={"font-extrabold tracking-tight leading-snug " + (isCompact ? "text-[15px]" : "text-[22px]")}>
            {label.receiver_name}
          </div>
          <div
            className={"mt-0.5 break-words leading-snug text-black/90 " + (isCompact ? "text-[11.5px]" : "text-[15px]")}
          >
            {label.receiver_address_line1}
            {label.receiver_address_line2 ? (
              <>
                <br />
                {label.receiver_address_line2}
              </>
            ) : null}
            <br />
            {label.receiver_city}, {label.receiver_state} - <b className="tracking-wide">{label.receiver_pincode}</b>
          </div>
          <div className={"mt-1.5 " + (isCompact ? "text-[12px]" : "text-[15px]")}>
            <span className="uppercase tracking-wider font-semibold text-black/70 text-[0.85em]">Mob - </span>{" "}
            <span className="font-semibold tracking-wide">
              {label.receiver_mobile_1}
              {label.receiver_mobile_2 ? `, ${label.receiver_mobile_2}` : ""}
            </span>
          </div>
          {label.order_reference ? (
            <div className={"mt-0.5 " + (isCompact ? "text-[12px]" : "text-[15px]")}>
              <span className="uppercase tracking-wider font-semibold text-black/70 text-[0.85em]">Order Ref - </span>{" "}
              <span className="font-semibold tracking-wide">{label.order_reference}</span>
            </div>
          ) : null}
        </div>

        {/* QR block — occupies the top-right corner properly */}
        <div className="flex flex-col items-center shrink-0">
          <div className="bg-white p-1.5 border border-black">
            <QRCodeSVG
              value={getQrPayload(label.courier_name, label.tracking_id)}
              size={qrSize}
              level="M"
              includeMargin={false}
            />
          </div>
          <div
            className={
              "text-center mt-1 font-semibold uppercase tracking-wider " + (isCompact ? "text-[8px]" : "text-[11px]")
            }
          >
            Scan QR for Tracking
          </div>
        </div>
      </div>

      {/* Shipment info — Courier and AWB centered on their own lines */}
      <div className={"mt-1 pt-1 text-center " + (isCompact ? "text-[11px]" : "text-sm")}>
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="uppercase tracking-wider font-semibold">Courier:</span>
          <span className="font-bold">{label.courier_name}</span>
        </div>
        <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
          <span className="uppercase tracking-wider font-semibold">AWB:</span>
          <span className={"font-bold tracking-wider " + (isCompact ? "text-[13px]" : "text-lg")}>
            {label.tracking_id}
          </span>
        </div>
      </div>

      {/* Barcode — centered directly below AWB */}
      {canRenderBarcode ? (
        <div className="mt-1 flex justify-center items-center">
          <Barcode
            value={trackingForBarcode}
            format="CODE128"
            height={barcodeHeight}
            width={barcodeWidth}
            fontSize={barcodeFontSize}
            margin={0}
            displayValue
            background="#ffffff"
            lineColor="#000000"
            textAlign="center"
            font="'Outfit', 'Inter', 'Helvetica Neue', Arial, sans-serif"
          />
        </div>
      ) : null}
    </div>
  );
}
