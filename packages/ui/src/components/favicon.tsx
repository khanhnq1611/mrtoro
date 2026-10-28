import { Link, Meta } from "@solidjs/meta"

export const Favicon = () => {
  return (
    <>
      <Link rel="icon" type="image/png" href="/torolab-96x96.png" sizes="96x96" />
      <Link rel="shortcut icon" href="/torolab.ico" />
      <Link rel="apple-touch-icon" sizes="180x180" href="/torolab-apple-touch-icon.png" />
      <Link rel="manifest" href="/torolab.webmanifest" />
      <Meta name="apple-mobile-web-app-title" content="torolab" />
    </>
  )
}
