import asyncio
import time
from typing import Optional
import tiktoken  # You can keep this if you want to count tokens the same way


class APIRateLimiter:
    def __init__(self, requests_per_minute: int = 60, tokens_per_minute: int = 150000):
        """
        DeepSeek typically has different rate limits than Claude.
        Adjust these values based on your DeepSeek API plan.
        """
        self.requests_per_minute = requests_per_minute
        self.tokens_per_minute = tokens_per_minute
        self.request_count = 0
        self.token_bucket = tokens_per_minute
        self.last_update = time.time()
        self.lock = asyncio.Lock()
        self.encoder = tiktoken.get_encoding(
            "cl100k_base"
        )  # Keep same encoding for consistency
        print("✓ DeepSeek Rate Limiter initialized")

    async def wait_for_tokens(self, text: str) -> None:
        """Wait until enough tokens and request capacity are available"""
        num_tokens = len(self.encoder.encode(text))
        print(
            f"\nRequest for {num_tokens} tokens (current bucket: {self.token_bucket})"
        )

        async with self.lock:
            current_time = time.time()
            time_passed = current_time - self.last_update

            # Reset request count if a minute has passed
            if time_passed > 60:
                self.request_count = 0
                self.token_bucket = self.tokens_per_minute
                self.last_update = current_time

            # Check if we're exceeding request rate
            if self.request_count >= self.requests_per_minute:
                wait_time = 60 - time_passed
                print(f"Request limit reached. Waiting {wait_time:.2f} seconds...")
                await asyncio.sleep(wait_time)
                self.request_count = 0
                self.token_bucket = self.tokens_per_minute
                self.last_update = time.time()

            # Handle token rate limiting (similar to before)
            if num_tokens > self.tokens_per_minute:
                minutes_needed = num_tokens / self.tokens_per_minute
                wait_time = minutes_needed * 60
                print(
                    f"Large request detected. Waiting {wait_time:.2f} seconds for full replenishment..."
                )
                await asyncio.sleep(wait_time)
                self.token_bucket = self.tokens_per_minute
                self.last_update = time.time()

            while num_tokens > self.token_bucket:
                tokens_needed = num_tokens - self.token_bucket
                wait_time = (tokens_needed / self.tokens_per_minute) * 60
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
                f"✓ Request approved. Using {num_tokens} tokens. {self.token_bucket} tokens remaining. {self.request_count}/{self.requests_per_minute} requests this minute."
            )
