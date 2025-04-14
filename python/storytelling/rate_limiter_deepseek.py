import asyncio
import time
from typing import Optional
import tiktoken


class APIRateLimiter:
    def __init__(
        self,
        requests_per_minute: int = 60,
        tokens_per_minute: int = 150000,
        max_wait_time: float = 30.0,
        max_prompt_tokens: int = 10000,
    ):
        self.requests_per_minute = requests_per_minute
        self.tokens_per_minute = tokens_per_minute
        self.max_wait_time = max_wait_time  # Maximum seconds to wait for any request
        self.max_prompt_tokens = max_prompt_tokens  # Reject prompts larger than this
        self.request_count = 0
        self.token_bucket = tokens_per_minute
        self.last_update = time.time()
        self.lock = asyncio.Lock()
        self.encoder = tiktoken.get_encoding("cl100k_base")
        print("✓ DeepSeek Rate Limiter initialized")

    async def wait_for_tokens(self, text: str) -> None:
        """Wait until enough tokens and request capacity are available"""
        num_tokens = len(self.encoder.encode(text))

        # Reject if prompt is too large
        if num_tokens > self.max_prompt_tokens:
            raise ValueError(
                f"Prompt too large ({num_tokens} tokens). Max allowed is {self.max_prompt_tokens}"
            )

        print(
            f"\nRequest for {num_tokens} tokens (current bucket: {self.token_bucket})"
        )

        start_time = time.time()
        async with self.lock:
            while True:
                current_time = time.time()
                time_passed = current_time - self.last_update

                # Reset counters if a minute has passed
                if time_passed > 60:
                    self.request_count = 0
                    self.token_bucket = self.tokens_per_minute
                    self.last_update = current_time

                # Check if we've waited too long
                if (current_time - start_time) > self.max_wait_time:
                    raise TimeoutError(
                        f"Waited too long ({self.max_wait_time}s) for tokens"
                    )

                # Check request rate limit
                if self.request_count >= self.requests_per_minute:
                    wait_time = max(0, 60 - time_passed)
                    if wait_time > 0:
                        print(
                            f"Request limit reached. Waiting {wait_time:.2f} seconds..."
                        )
                        await asyncio.sleep(wait_time)
                    continue  # Check conditions again after waiting

                # Check token availability
                if num_tokens <= self.token_bucket:
                    break  # Proceed with the request

                # Calculate how long to wait for enough tokens
                tokens_needed = num_tokens - self.token_bucket
                wait_time = (tokens_needed / self.tokens_per_minute) * 60
                wait_time = min(
                    wait_time, self.max_wait_time - (current_time - start_time)
                )

                if wait_time > 0:
                    print(
                        f"Waiting {wait_time:.2f} seconds for {tokens_needed} more tokens..."
                    )
                    await asyncio.sleep(wait_time)

                # Update bucket after waiting
                current_time = time.time()
                time_passed = current_time - self.last_update
                tokens_to_add = int(time_passed * (self.tokens_per_minute / 60))
                self.token_bucket = min(
                    self.tokens_per_minute, self.token_bucket + tokens_to_add
                )
                self.last_update = current_time

            # Deduct tokens and increment request count
            self.token_bucket -= num_tokens
            self.request_count += 1
            print(
                f"✓ Request approved. Using {num_tokens} tokens. "
                f"{self.token_bucket} tokens remaining. "
                f"{self.request_count}/{self.requests_per_minute} requests this minute."
            )
