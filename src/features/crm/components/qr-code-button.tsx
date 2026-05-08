import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  childName: string;
  guardianName: string | null;
  token: string | null;
}

export function QrCodeButton({ childName, guardianName, token }: Props) {
  const [open, setOpen] = useState(false);

  if (!token) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          aria-label="Ver QR Code da sessao"
        >
          <QrCode className="size-3.5" />
          QR
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code de check-out</DialogTitle>
          <DialogDescription>
            Apresente este codigo na saida para liberar a crianca.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-white p-4 shadow-inner">
            <QRCodeSVG
              value={token}
              size={224}
              level="M"
              fgColor="#1E78DC"
              bgColor="#ffffff"
            />
          </div>
          <div className="text-center">
            <p className="text-base font-bold">{childName}</p>
            {guardianName ? (
              <p className="text-xs text-muted-foreground">
                Resp.: {guardianName}
              </p>
            ) : null}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground break-all">
            {token}
          </p>
          <p className="text-center text-[11px] text-muted-foreground">
            Para liberar a crianca, va em{" "}
            <strong>QR Check-out</strong> no menu lateral, escaneie ou cole este
            codigo.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
