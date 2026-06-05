"""Launch twist_mux to arbitrate /cmd_vel by priority for AMRDetail."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description() -> LaunchDescription:
    use_sim_time = LaunchConfiguration("use_sim_time")
    twist_mux_params = PathJoinSubstitution(
        [FindPackageShare("amrdetail_safety"), "config", "twist_mux.yaml"]
    )

    return LaunchDescription(
        [
            DeclareLaunchArgument(
                "use_sim_time",
                default_value="true",
                description="Use simulation clock.",
            ),
            Node(
                package="twist_mux",
                executable="twist_mux",
                name="twist_mux",
                output="screen",
                parameters=[twist_mux_params, {"use_sim_time": use_sim_time}],
                remappings=[("cmd_vel_out", "cmd_vel")],
            ),
        ]
    )
