package expo.modules.nativeunrar

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import net.sf.sevenzipjbinding.ExtractOperationResult
import net.sf.sevenzipjbinding.SevenZip
import net.sf.sevenzipjbinding.impl.RandomAccessFileInStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.Locale
import java.util.zip.ZipFile

class NativeUnrarModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeUnrar")

    AsyncFunction("extractImages") { archivePath: String, outputPath: String ->
      extractImages(archivePath, outputPath)
    }
  }

  private fun extractImages(archivePath: String, outputPath: String): Int {
    val archiveFile = File(archivePath)
    if (!archiveFile.exists()) {
      throw Exception("No se encontró el archivo: $archivePath")
    }

    val outputDir = File(outputPath)
    if (!outputDir.exists() && !outputDir.mkdirs()) {
      throw Exception("No se pudo crear la carpeta de páginas.")
    }

    val extracted = if (isZipArchive(archiveFile)) {
      extractZipImages(archiveFile, outputDir)
    } else {
      extractRarImages(archiveFile, outputDir)
    }

    if (extracted == 0) {
      throw Exception("El archivo no contiene páginas de imagen.")
    }

    return extracted
  }

  private fun isZipArchive(file: File): Boolean {
    file.inputStream().use { stream ->
      val header = ByteArray(4)
      val read = stream.read(header)
      return read >= 2 && header[0] == 0x50.toByte() && header[1] == 0x4B.toByte()
    }
  }

  private fun extractZipImages(archiveFile: File, outputDir: File): Int {
    val zip = ZipFile(archiveFile)
    try {
      val entries = zip.entries()
        .asSequence()
        .filter { !it.isDirectory && isImagePath(it.name) }
        .sortedWith { a, b -> naturalCompare(a.name, b.name) }
        .toList()

      entries.forEachIndexed { index, entry ->
        zip.getInputStream(entry).use { input ->
          val dest = File(outputDir, paddedName(index, entry.name))
          FileOutputStream(dest).use { output -> input.copyTo(output) }
        }
      }
      return entries.size
    } finally {
      zip.close()
    }
  }

  private fun extractRarImages(archiveFile: File, outputDir: File): Int {
    synchronized(NativeUnrarModule::class.java) {
      SevenZip.initSevenZipFromPlatformJAR()
    }

    val randomAccessFile = RandomAccessFile(archiveFile, "r")
    val inStream = RandomAccessFileInStream(randomAccessFile)
    val archive = SevenZip.openInArchive(null, inStream)

    try {
      val items = archive.simpleInterface.archiveItems
        .filter { !it.isFolder && isImagePath(it.path ?: "") }
        .sortedWith { a, b -> naturalCompare(a.path ?: "", b.path ?: "") }

      items.forEachIndexed { index, item ->
        val dest = File(outputDir, paddedName(index, item.path ?: "page.jpg"))
        var stream: FileOutputStream? = null
        val result = item.extractSlow { data ->
          if (stream == null) {
            stream = FileOutputStream(dest, false)
          }
          stream?.write(data)
          data.size
        }
        stream?.flush()
        stream?.close()
        if (result != ExtractOperationResult.OK || !dest.exists() || dest.length() == 0L) {
          if (dest.exists()) dest.delete()
        }
      }

      return outputDir.listFiles()?.count { isImagePath(it.name) } ?: 0
    } finally {
      archive.close()
      inStream.close()
      randomAccessFile.close()
    }
  }

  private fun isImagePath(path: String): Boolean {
    val normalized = path.replace('\\', '/')
    if (normalized.contains("__MACOSX") || normalized.endsWith(".DS_Store")) {
      return false
    }
    return Regex("\\.(jpe?g|png|webp|gif|bmp)$", RegexOption.IGNORE_CASE).containsMatchIn(normalized)
  }

  private fun paddedName(index: Int, original: String): String {
    val ext = original.substringAfterLast('.', "jpg").lowercase(Locale.US)
    val safeExt = if (Regex("jpe?g|png|webp|gif|bmp").matches(ext)) ext else "jpg"
    return String.format(Locale.US, "%04d.%s", index, safeExt)
  }

  private fun naturalCompare(left: String, right: String): Int {
    val a = left.replace('\\', '/').lowercase(Locale.US)
    val b = right.replace('\\', '/').lowercase(Locale.US)
    val chunks = Regex("\\d+|\\D+")
    val leftParts = chunks.findAll(a).map { it.value }.toList()
    val rightParts = chunks.findAll(b).map { it.value }.toList()
    val size = minOf(leftParts.size, rightParts.size)
    for (i in 0 until size) {
      val l = leftParts[i]
      val r = rightParts[i]
      val cmp = if (l[0].isDigit() && r[0].isDigit()) {
        l.toBigInteger().compareTo(r.toBigInteger())
      } else {
        l.compareTo(r)
      }
      if (cmp != 0) return cmp
    }
    return leftParts.size.compareTo(rightParts.size)
  }
}
