import { Redirect } from "expo-router";
import { ShowcaseScreen } from "@/features/showcase/showcase-screen";
export default function DesignShowcaseRoute() {
  return __DEV__ ? <ShowcaseScreen /> : <Redirect href="/" />;
}
