import { QRCodeSVG } from "qrcode.react";
import type { Label } from "@/lib/labels";
import { getQrPayload } from "@/lib/labels";

interface Props {
  label: Label;
  size?: "compact" | "full";
}

export function ShippingLabel({ label, size = "compact" }: Props) {
  const isCompact = size === "compact";
  const qrSize = isCompact ? 84 : 180;

  return (
    <div
      className={
        (isCompact
          ? "print-label text-black bg-white text-[11px] leading-tight"
          : "print-label-full text-black bg-white text-base leading-snug") +
        " border border-dashed border-black flex flex-col h-full w-full"
      }
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div
        className={
          "border-b border-black pb-1 mb-2 font-black tracking-widest text-center " +
          (isCompact ? "text-sm" : "text-2xl")
        }
      >
        PARCEL LABEL
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex-1 min-w-0">
          <div className={"font-semibold " + (isCompact ? "text-[10px]" : "text-sm") + " uppercase"}>
            To:
          </div>
          <div className={"font-bold " + (isCompact ? "text-[13px]" : "text-xl")}>
            {label.receiver_name}
          </div>
          <div className="mt-0.5 break-words">
            {label.receiver_address_line1}
            {label.receiver_address_line2 ? (
              <>
                <br />
                {label.receiver_address_line2}
              </>
            ) : null}
            <br />
            {label.receiver_city}, {label.receiver_state} - <b>{label.receiver_pincode}</b>
          </div>
          <div className={"mt-1 " + (isCompact ? "text-[10px]" : "text-sm")}>
            <b>Mob:</b> {label.receiver_mobile_1}
            {label.receiver_mobile_2 ? `, ${label.receiver_mobile_2}` : ""}
          </div>

          <div className={"mt-2 pt-1 border-t border-black " + (isCompact ? "text-[10px]" : "text-sm")}>
            <div>
              <b>Courier:</b> {label.courier_name}
            </div>
            <div className="break-all">
              <b>AWB:</b>{" "}
              <span className={"font-mono font-bold " + (isCompact ? "text-[12px]" : "text-lg")}>
                {label.tracking_id}
              </span>
            </div>
            {label.order_reference ? (
              <div>
                <b>Order Ref:</b> {label.order_reference}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-center justify-end shrink-0">
          <div className="bg-white p-1 border border-black">
            <QRCodeSVG
              value={getQrPayload(label.courier_name, label.tracking_id)}
              size={qrSize}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className={"text-center mt-1 " + (isCompact ? "text-[8px]" : "text-xs")}>
            Scan QR for Tracking ID
          </div>
        </div>
      </div>
    </div>
  );
}
