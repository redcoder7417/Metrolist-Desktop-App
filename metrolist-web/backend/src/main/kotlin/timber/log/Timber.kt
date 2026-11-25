package timber.log

/** JVM compatibility logger for the shared Android InnerTube source. */
object Timber {
    fun d(message: String, vararg args: Any?) = log("DEBUG", message, *args)
    fun w(message: String, vararg args: Any?) = log("WARN", message, *args)
    fun e(message: String, vararg args: Any?) = log("ERROR", message, *args)
    fun e(error: Throwable, message: String, vararg args: Any?) = log("ERROR", "$message: ${error.message}", *args)

    private fun log(level: String, message: String, vararg args: Any?) {
        println("[$level] ${if (args.isEmpty()) message else message.format(*args)}")
    }
}
