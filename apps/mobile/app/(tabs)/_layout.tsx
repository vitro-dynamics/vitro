import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: "#000000",
				headerShown: false,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Counter",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="radio-button-on-outline" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
