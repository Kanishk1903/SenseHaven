package app.senseheaven.child.network

import retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

/** Device API (File 03 binding). Auth is a Bearer token added by [authInterceptor]. */
interface DeviceApi {

    @POST("device/pair")
    suspend fun pair(@Body body: PairRequest): PairResponse

    @GET("device/sync")
    suspend fun sync(
        @Query("config_version") configVersion: Int? = null,
        @Query("pin_version") pinVersion: Int? = null,
    ): SyncResponse

    @POST("device/events")
    suspend fun events(@Body batch: EventsBatch): EventsAck

    @POST("device/commands/{id}/ack")
    suspend fun ackCommand(@Path("id") id: Long)

    companion object {
        fun create(baseUrl: String, authInterceptor: okhttp3.Interceptor): DeviceApi {
            val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
            val client = OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .connectTimeout(30, TimeUnit.SECONDS)  // E6-2: cold start tolerance
                .readTimeout(60, TimeUnit.SECONDS)
                .build()
            return Retrofit.Builder()
                .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
                .client(client)
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()
                .create(DeviceApi::class.java)
        }
    }
}
