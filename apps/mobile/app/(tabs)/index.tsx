import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import CounterDOM from "@/components/dom/counter";

/**
 * Native shell for the counter screen.
 *
 * This file lives in the native layer. Its job is to:
 *  - Own any state that needs to survive tab switches
 *  - Wrap native APIs (haptics, camera, secure storage, etc.) as serializable callbacks
 *  - Pass everything as props to the DOM component below
 *
 * The DOM component does the rendering. This file does nothing visual.
 */
export default function CounterScreen() {
	const [count, setCount] = useState(0);
	const [isPending, setIsPending] = useState(false);

	// onIncrement becomes an async RPC call across the native↔WebView bridge.
	// The DOM component awaits it — so keeping it quick is important.
	const onIncrement = useCallback(async () => {
		setIsPending(true);
		await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		setCount((c) => c + 1);
		setIsPending(false);
	}, []);

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "Counter" }} />
			<CounterDOM
				count={count}
				isPending={isPending}
				onIncrement={onIncrement}
				// dom prop controls the underlying WebView
				dom={{ style: styles.webview }}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f9f8f5", // matches --background OKLCH approx
	},
	webview: {
		flex: 1,
	},
});
