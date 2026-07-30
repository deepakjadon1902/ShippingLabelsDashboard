import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import type { Label } from "@/lib/labels";
import { getQrPayload } from "@/lib/labels";
import { useWebsiteName } from "@/lib/settings";

interface Props {
  label: Label;
  size?: "compact" | "full" | "mini" | "half";
}

export function ShippingLabel({ label, size = "compact" }: Props) {
  const [websiteName] = useWebsiteName();
  const isFull = size === "full";
  const isHalf = size === "half";
  const isMini = size === "mini";

  const qrSize = isFull ? 168 : isHalf ? 118 : isMini ? 62 : 84;
  const reviewQrSize = isFull ? 110 : isHalf ? 78 : isMini ? 44 : 60;
  const barcodeHeight = isFull ? 90 : isHalf ? 60 : isMini ? 32 : 44;
  const barcodeWidth = isFull ? 3 : isHalf ? 2 : isMini ? 1.2 : 1.6;
  const barcodeFontSize = isFull ? 20 : isHalf ? 14 : isMini ? 10 : 12;

  const trackingForBarcode = (label.tracking_id || "").trim();
  const canRenderBarcode = trackingForBarcode.length > 0 && trackingForBarcode !== "-";

  const containerClass = isFull
    ? "print-label-full text-black bg-white text-lg leading-snug p-6"
    : isHalf
      ? "print-label-half text-black bg-white text-[14px] leading-snug p-4"
      : isMini
        ? "print-label text-black bg-white text-[10px] leading-tight p-2"
        : "print-label text-black bg-white text-[11.5px] leading-tight p-2.5";

  const hasSender = !!(
    label.sender_name ||
    label.sender_address ||
    label.sender_phone ||
    label.sender_website
  );
  const hasReviewQr = !!(label.sender_review_url && label.sender_review_url.trim());

  const fromLabelSize = isFull
    ? "text-sm"
    : isHalf
      ? "text-[10px]"
      : isMini
        ? "text-[7px]"
        : "text-[9px]";
  const fromNameSize = isFull
    ? "text-[16px]"
    : isHalf
      ? "text-[12px]"
      : isMini
        ? "text-[9px]"
        : "text-[11px]";
  const fromBodySize = isFull
    ? "text-[13px]"
    : isHalf
      ? "text-[10px]"
      : isMini
        ? "text-[7.5px]"
        : "text-[9.5px]";
  const returnNoteSize = isFull
    ? "text-[11px]"
    : isHalf
      ? "text-[9px]"
      : isMini
        ? "text-[6.5px]"
        : "text-[8px]";
  const reviewCaptionSize = isFull
    ? "text-[11px]"
    : isHalf
      ? "text-[8.5px]"
      : isMini
        ? "text-[6px]"
        : "text-[7.5px]";
  return (
    <div
      className={`${containerClass} border border-dashed border-black flex flex-col w-full overflow-hidden`}
      style={{
        fontFamily: "'Outfit', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontFeatureSettings: "'tnum' 1, 'cv11' 1",
      }}
    >
      <div className="pb-2 mb-2 border-b border-black/25">
        <div className={`flex ${isMini ? "gap-2" : isFull ? "gap-6" : isHalf ? "gap-4" : "gap-3"}`}>
          <div className="flex-1 min-w-0">
            <div
              className={
                "font-semibold tracking-[0.2em] uppercase text-black/60 " +
                (isFull ? "text-base" : isHalf ? "text-xs" : isMini ? "text-[8px]" : "text-[10px]")
              }
            >
              To
            </div>
            <div
              className={
                "font-extrabold tracking-tight leading-snug " +
                (isFull
                  ? "text-[34px]"
                  : isHalf
                    ? "text-[22px]"
                    : isMini
                      ? "text-[13px]"
                      : "text-[16px]")
              }
            >
              {label.receiver_name}
            </div>
            <div
              className={
                "mt-1 break-words leading-snug text-black/90 " +
                (isFull
                  ? "text-[20px]"
                  : isHalf
                    ? "text-[14.5px]"
                    : isMini
                      ? "text-[10px]"
                      : "text-[12px]")
              }
            >
              {label.receiver_address_line1}
              {label.receiver_address_line2 ? (
                <>
                  <br />
                  {label.receiver_address_line2}
                </>
              ) : null}
              <br />
              {label.receiver_city}, {label.receiver_state} -{" "}
              <b className="tracking-wide">{label.receiver_pincode}</b>
            </div>
            <div
              className={`mt-1 ${isFull ? "text-[20px]" : isHalf ? "text-[15px]" : isMini ? "text-[10.5px]" : "text-[12.5px]"}`}
            >
              <span className="uppercase tracking-wider font-semibold text-black/60 text-[0.85em]">
                Mob -{" "}
              </span>{" "}
              <span className="font-semibold tracking-wide">
                {label.receiver_mobile_1}
                {label.receiver_mobile_2 ? `, ${label.receiver_mobile_2}` : ""}
              </span>
            </div>
            {label.order_reference ? (
              <div
                className={`mt-0.5 ${isFull ? "text-[20px]" : isHalf ? "text-[15px]" : isMini ? "text-[10.5px]" : "text-[12.5px]"}`}
              >
                <span className="uppercase tracking-wider font-semibold text-black/60 text-[0.85em]">
                  Order Ref -{" "}
                </span>{" "}
                <span className="font-semibold tracking-wide">{label.order_reference}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center shrink-0">
            <div
              className={`bg-white border border-black ${isMini ? "p-1" : isFull ? "p-2" : "p-1.5"}`}
            >
              <QRCodeSVG
                value={getQrPayload(label.courier_name, label.tracking_id)}
                size={qrSize}
                level="M"
                includeMargin={false}
              />
            </div>
            <div
              className={
                "text-center mt-1 font-semibold uppercase tracking-wider " +
                (isFull
                  ? "text-[13px]"
                  : isHalf
                    ? "text-[10px]"
                    : isMini
                      ? "text-[7px]"
                      : "text-[8px]")
              }
            >
              Scan QR for Tracking
            </div>
          </div>
        </div>

        <div
          className={`text-center ${isFull ? "mt-4 text-[19px]" : isHalf ? "mt-3 text-[14px]" : isMini ? "mt-2 text-[10px]" : "mt-2 text-[12px]"}`}
        >
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="uppercase tracking-wider font-semibold text-black/60">Courier:</span>
            <span className="font-bold">{label.courier_name}</span>
          </div>
          <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
            <span className="uppercase tracking-wider font-semibold text-black/60">AWB:</span>
            <span
              className={`font-bold tracking-wider ${isFull ? "text-[22px]" : isHalf ? "text-[16px]" : isMini ? "text-[11px]" : "text-[14px]"}`}
            >
              {label.tracking_id}
            </span>
          </div>
        </div>

        {canRenderBarcode ? (
          <div className={`flex justify-center items-center ${isFull ? "mt-2" : "mt-1"}`}>
            <Barcode
              value={trackingForBarcode}
              format="CODE128"
              height={barcodeHeight}
              width={barcodeWidth}
              fontSize={barcodeFontSize}
              margin={0}
              displayValue={false}
              background="#ffffff"
              lineColor="#000000"
              textAlign="center"
              font="'Outfit', 'Inter', 'Helvetica Neue', Arial, sans-serif"
            />
          </div>
        ) : null}
      </div>

      {hasSender || hasReviewQr ? (
        <div
          className={
            "flex items-start justify-between " + (isMini ? "gap-2" : isFull ? "gap-4" : "gap-3")
          }
        >
          <div className="flex-1 min-w-0">
            <div
              className={`font-semibold tracking-[0.2em] uppercase text-black/60 ${fromLabelSize}`}
            >
              From
            </div>
            {label.sender_name ? (
              <div className={`font-bold leading-snug ${fromNameSize}`}>{label.sender_name}</div>
            ) : null}
            {label.sender_address ? (
              <div
                className={`leading-snug text-black/85 break-words whitespace-pre-line ${fromBodySize}`}
              >
                {label.sender_address}
              </div>
            ) : null}
            {label.sender_phone ? (
              <div className={`leading-snug ${fromBodySize}`}>
                <span className="text-black/60 font-semibold">Phone: </span>
                <span className="font-semibold">{label.sender_phone}</span>
              </div>
            ) : null}
            {label.sender_website ? (
              <div className={`leading-snug ${fromBodySize}`}>
                <span className="text-black/60 font-semibold">Web: </span>
                <span className="font-semibold">{label.sender_website}</span>
              </div>
            ) : null}
            <div className={`italic text-black/70 mt-0.5 ${returnNoteSize}`}>
              If undelivered, please return to above address.
            </div>
          </div>

          {hasReviewQr ? (
            <div className="flex flex-col items-center shrink-0">
              <div className={`bg-white border border-black ${isMini ? "p-0.5" : "p-1"}`}>
                <QRCodeSVG
                  value={label.sender_review_url!.trim()}
                  size={reviewQrSize}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className={`text-center mt-0.5 font-medium text-black/80 ${reviewCaptionSize}`}>
                Scan QR for Review
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {websiteName ? (
        <div
          className={
            "pt-1 border-t border-black/20 text-center font-medium tracking-wide text-black/70 " +
            (isFull
              ? "mt-3 text-[14px]"
              : isHalf
                ? "mt-2 text-[11px]"
                : isMini
                  ? "mt-1 text-[7.5px]"
                  : "mt-1 text-[9px]")
          }
        >
          Thank you for your order - <span className="font-semibold text-black">{websiteName}</span>
        </div>
      ) : null}
    </div>
  );
}
