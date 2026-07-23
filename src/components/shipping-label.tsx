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
  const barcodeHeight = isCompact ? 44 : 68;
  const barcodeWidth = isCompact ? 1.6 : 2.4;
  const barcodeFontSize = isCompact ? 12 : 16;

  const trackingForBarcode = (label.tracking_id || "").trim();
  const canRenderBarcode = trackingForBarcode.length > 0 && trackingForBarcode !== "—";

  return (
    <div
      className={
        (isCompact
          ? "print-label text-black bg-white text-[11.5px] leading-tight"
          : "print-label-full text-black bg-white text-base leading-snug") +
        " border border-dashed border-black flex flex-col h-full w-full overflow-hidden"
      }
      style={{
        fontFamily: "'Outfit', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontFeatureSettings: "'tnum' 1, 'cv11' 1",
      }}
    >
      {/* Saffron brand accent bar */}
      <div
        style={{ background: "#E8680A" }}
        className={isCompact ? "h-1.5 w-full shrink-0" : "h-2.5 w-full shrink-0"}
      />

      <div className={"flex flex-col flex-1 min-h-0 " + (isCompact ? "p-2.5" : "p-5")}>
        {/* Top: receiver on the left, QR neatly on the right */}
        <div className="flex gap-3 min-h-0">
          <div className="flex-1 min-w-0">
            <div
              className={
                "font-semibold tracking-[0.2em] " +
                (isCompact ? "text-[10px]" : "text-sm") +
                " uppercase text-black/60"
              }
            >
              To
            </div>
            <div className={"font-extrabold tracking-tight leading-snug " + (isCompact ? "text-[16px]" : "text-[24px]")}>
              {label.receiver_name}
            </div>
            <div
              className={
                "mt-1 break-words leading-snug text-black/90 " + (isCompact ? "text-[12px]" : "text-[15.5px]")
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
              {label.receiver_city}, {label.receiver_state} - <b className="tracking-wide">{label.receiver_pincode}</b>
            </div>
            <div className={"mt-1.5 " + (isCompact ? "text-[12.5px]" : "text-[15.5px]")}>
              <span className="uppercase tracking-wider font-semibold text-black/60 text-[0.85em]">Mob - </span>{" "}
              <span className="font-semibold tracking-wide">
                {label.receiver_mobile_1}
                {label.receiver_mobile_2 ? `, ${label.receiver_mobile_2}` : ""}
              </span>
            </div>
            {label.order_reference ? (
              <div className={"mt-0.5 " + (isCompact ? "text-[12.5px]" : "text-[15.5px]")}>
                <span className="uppercase tracking-wider font-semibold text-black/60 text-[0.85em]">Order Ref - </span>{" "}
                <span className="font-semibold tracking-wide">{label.order_reference}</span>
              </div>
            ) : null}
          </div>

          {/* QR block */}
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

        {/* Divider before shipment info */}
        <div className="border-t border-black/70 my-2" />

        {/* Shipment info */}
        <div className={"text-center " + (isCompact ? "text-[12px]" : "text-[15px]")}>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="uppercase tracking-wider font-semibold text-black/60">Courier:</span>
            <span className="font-bold">{label.courier_name}</span>
          </div>
          <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
            <span className="uppercase tracking-wider font-semibold text-black/60">AWB:</span>
            <span className={"font-bold tracking-wider " + (isCompact ? "text-[14px]" : "text-lg")}>
              {label.tracking_id}
            </span>
          </div>
        </div>

        {/* Barcode */}
        {canRenderBarcode ? (
          <div className="mt-1.5 flex justify-center items-center">
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

        {/* Footer divider for visual balance */}
        <div className="mt-auto pt-2">
          <div className="border-t border-black/70" />
          <div
            className={
              "text-center mt-1 uppercase tracking-[0.25em] font-semibold text-black/60 " +
              (isCompact ? "text-[8px]" : "text-[10px]")
            }
          >
            Thank you for shopping with us
          </div>
        </div>
      </div>
    </div>
  );
}
