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
  const qrSize = isCompact ? 92 : 150;
  const barcodeHeight = isCompact ? 52 : 90;
  const barcodeWidth = isCompact ? 1.7 : 2.6;
  const barcodeFontSize = isCompact ? 12 : 17;

  const trackingForBarcode = (label.tracking_id || "").trim();
  const canRenderBarcode = trackingForBarcode.length > 0 && trackingForBarcode !== "—";

  const fontStack =
    "'Manrope', 'Inter', 'Helvetica Neue', Helvetica, Arial, ui-sans-serif, system-ui, sans-serif";
  const monoStack =
    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

  return (
    <div
      className={
        (isCompact
          ? "print-label text-[12px] leading-tight p-3"
          : "print-label-full text-[17px] leading-snug p-6") +
        " text-black bg-white border border-dashed border-black flex flex-col h-full w-full justify-between"
      }
      style={{
        fontFamily: fontStack,
        fontFeatureSettings: "'tnum' 1, 'ss01' 1, 'cv11' 1",
      }}
    >
      {/* Header */}
      <div
        className={
          "border-b-2 border-black pb-1.5 mb-2 font-extrabold tracking-[0.35em] text-center " +
          (isCompact ? "text-sm" : "text-3xl")
        }
      >
        PARCEL LABEL
      </div>

      {/* Middle: address + QR — grows to fill available vertical space */}
      <div className="flex gap-3 flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className={
              "font-bold tracking-[0.2em] text-black/70 " +
              (isCompact ? "text-[10px]" : "text-[13px]")
            }
          >
            TO
          </div>
          <div
            className={
              "font-extrabold tracking-tight leading-tight mt-0.5 " +
              (isCompact ? "text-[17px]" : "text-[26px]")
            }
          >
            {label.receiver_name}
          </div>
          <div
            className={
              "mt-1 break-words leading-snug text-black " +
              (isCompact ? "text-[12.5px]" : "text-[17px]")
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
            <b className="tracking-wide" style={{ fontFamily: monoStack }}>
              {label.receiver_pincode}
            </b>
          </div>
          <div
            className={
              "mt-auto pt-2 " + (isCompact ? "text-[13px]" : "text-[18px]")
            }
          >
            <span className="font-bold tracking-[0.15em] text-black/70 text-[0.8em]">
              MOB
            </span>{" "}
            <span
              className="font-semibold tracking-wide"
              style={{ fontFamily: monoStack }}
            >
              {label.receiver_mobile_1}
              {label.receiver_mobile_2 ? `, ${label.receiver_mobile_2}` : ""}
            </span>
          </div>
        </div>

        {/* QR block */}
        <div className="flex flex-col items-center shrink-0">
          <div className="bg-white p-1.5 border-2 border-black">
            <QRCodeSVG
              value={getQrPayload(label.courier_name, label.tracking_id)}
              size={qrSize}
              level="M"
              includeMargin={false}
            />
          </div>
          <div
            className={
              "text-center mt-1 font-bold uppercase tracking-[0.2em] " +
              (isCompact ? "text-[8px]" : "text-[11px]")
            }
          >
            Scan QR for Tracking
          </div>
        </div>
      </div>

      {/* Bottom: courier + AWB + barcode */}
      <div className={"mt-2 text-center " + (isCompact ? "text-[12px]" : "text-[17px]")}>
        <div className="flex items-baseline justify-center gap-2">
          <span className="uppercase tracking-[0.15em] font-bold text-black/70 text-[0.85em]">
            Courier:
          </span>
          <span className="font-extrabold tracking-tight">{label.courier_name}</span>
        </div>
        <div className="flex items-baseline justify-center gap-2 mt-1">
          <span className="uppercase tracking-[0.15em] font-bold text-black/70 text-[0.85em]">
            AWB:
          </span>
          <span
            className={"font-bold tracking-wider " + (isCompact ? "text-[14px]" : "text-[20px]")}
            style={{ fontFamily: monoStack }}
          >
            {label.tracking_id}
          </span>
        </div>
        {label.order_reference ? (
          <div className="mt-1">
            <span className="uppercase tracking-[0.15em] font-bold text-black/70 text-[0.85em]">
              Order Ref:
            </span>{" "}
            <span className="font-semibold">{label.order_reference}</span>
          </div>
        ) : null}

        {canRenderBarcode ? (
          <div className="mt-2 flex justify-center items-center">
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
              font={monoStack}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
