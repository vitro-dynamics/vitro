"use dom";

/**
 * Thin DOM component wrapper — the actual UI lives in packages/ui/src/screens/counter.tsx.
 *
 * This file's only job is:
 *  1. Apply the "use dom" directive so Metro compiles it as a web bundle
 *  2. Import the shared theme CSS
 *  3. Forward props from the native shell to CounterScreen
 *
 * Data flows: native shell → props → this wrapper → CounterScreen
 * Native APIs (haptics): passed as async prop callbacks from the native shell
 */

import "@app/ui/styles/theme.css";
import { CounterScreen } from "@app/ui/screens/counter";

type Props = {
	/** Controls the underlying WebView — passed through by Expo */
	dom?: import("expo/dom").DOMProps;
	count: number;
	isPending: boolean;
	/** Async because it crosses the native↔WebView bridge */
	onIncrement: () => Promise<void>;
};

export default function CounterDOM({ count, isPending, onIncrement }: Props) {
	return <CounterScreen count={count} isPending={isPending} onIncrement={onIncrement} />;
}
