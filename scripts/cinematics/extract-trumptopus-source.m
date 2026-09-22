#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <CoreImage/CoreImage.h>
#import <ImageIO/ImageIO.h>

// Local foreground segmentation. No generative service or source overwrite.
int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) { fprintf(stderr, "Usage: extract-source input.png output.png\n"); return 1; }
        NSURL *input = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[1]]];
        NSURL *output = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[2]]];
        if ([[NSFileManager defaultManager] fileExistsAtPath:output.path]) {
            fprintf(stderr, "Refusing to overwrite existing extraction\n"); return 1;
        }
        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithURL:input options:@{}];
        VNGenerateForegroundInstanceMaskRequest *request = [VNGenerateForegroundInstanceMaskRequest new];
        NSError *error = nil;
        if (![handler performRequests:@[request] error:&error]) {
            fprintf(stderr, "%s\n", error.description.UTF8String); return 1;
        }
        VNInstanceMaskObservation *observation = request.results.firstObject;
        if (!observation || observation.allInstances.count == 0) {
            fprintf(stderr, "No foreground instance found\n"); return 1;
        }
        CVPixelBufferRef buffer = [observation generateMaskedImageOfInstances:observation.allInstances
            fromRequestHandler:handler croppedToInstancesExtent:NO error:&error];
        if (!buffer) { fprintf(stderr, "%s\n", error.description.UTF8String); return 1; }
        CIImage *image = [CIImage imageWithCVPixelBuffer:buffer];
        CIContext *context = [CIContext contextWithOptions:@{}];
        CGImageRef result = [context createCGImage:image fromRect:image.extent];
        CGImageDestinationRef destination = CGImageDestinationCreateWithURL((__bridge CFURLRef)output, CFSTR("public.png"), 1, NULL);
        if (!result || !destination) { fprintf(stderr, "PNG setup failed\n"); return 1; }
        CGImageDestinationAddImage(destination, result, NULL);
        bool written = CGImageDestinationFinalize(destination);
        printf("%lu instances; %zux%zu; written=%d\n", (unsigned long)observation.allInstances.count,
            CGImageGetWidth(result), CGImageGetHeight(result), written);
        CGImageRelease(result);
        CFRelease(destination);
        return written ? 0 : 1;
    }
}
