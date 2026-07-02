// Type declarations for unplugin-icons virtual imports (~icons/<set>/<name>)
declare module "~icons/*" {
  import type { SVGProps, FunctionComponent } from "react";
  const component: FunctionComponent<SVGProps<SVGSVGElement>>;
  export default component;
}
