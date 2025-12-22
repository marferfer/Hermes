import streamlit as st
import os
import json
from pathlib import Path

# --- Configuración ---
st.set_page_config(page_title="Hermes - RAG con Permisos", layout="wide")
# --- Inicialización de Session State ---
if "user_department" not in st.session_state:
    st.session_state.user_department = "[1014] Sistemas"  # valor por defecto
if "active_section" not in st.session_state:
    st.session_state.active_section = "Chat"

# --- Estado de la sección activa ---
if "active_section" not in st.session_state:
    st.session_state.active_section = "Chat"

# --- Menú lateral ---
with st.sidebar:
    # Título en la parte superior
    st.title(" Hermes")
    st.markdown("---")
    
    # Navegación por secciones
    st.markdown("### 📌 Navegación")
    if st.button("💬 Chat", use_container_width=True):
        st.session_state.active_section = "Chat"
    if st.button("📚 Biblioteca", use_container_width=True):
        st.session_state.active_section = "Biblioteca"
    if st.button("📥 Subir Documento", use_container_width=True):
        st.session_state.active_section = "Subir"
    if st.button("👤 Mi Perfil", use_container_width=True):
        st.session_state.active_section = "Perfil"

# --- Crear carpetas ---
os.makedirs("docs", exist_ok=True)

# ==============================
# SECCIÓN: CHAT
# ==============================
if st.session_state.active_section == "Chat":
    st.title("💬 Chat")
    
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Mostrar historial
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
            if "sources" in msg and msg["sources"]:
                with st.expander("📎 Fuentes", expanded=False):
                    for source in msg["sources"]:
                        st.caption(f"• {source}")

    if prompt := st.chat_input("Escribe tu pregunta sobre los documentos..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.write(prompt)

        with st.chat_message("assistant"):
            with st.spinner("🔍 Buscando en documentos permitidos..."):
                try:
                    from rag_engine import query_rag
                    response, sources = query_rag(prompt, user_department=st.session_state["user_department"])
                    st.write(response)
                    if sources:
                        with st.expander("📎 Fuentes", expanded=False):
                            for source in sources:
                                st.caption(f"• {source}")
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": response,
                        "sources": sources
                    })
                except Exception as e:
                    error_msg = f"❌ Error: {str(e)}"
                    st.error(error_msg)
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": error_msg,
                        "sources": []
                    })

# ==============================
# SECCIÓN: BIBLIOTECA CON FILTROS AUTOMÁTICOS
# ==============================
elif st.session_state.active_section == "Biblioteca":
    st.title("📚 Biblioteca")
    st.markdown(f"_Documentos accesibles para: **{st.session_state['user_department']}**_")
    
    if "confirm_delete" not in st.session_state:
        st.session_state.confirm_delete = None
    
    # Estado para búsqueda
    if "search_query" not in st.session_state:
        st.session_state.search_query = ""

    # Obtener documentos accesibles
    docs_info = []
    docs_folder = Path("docs")
    
    if docs_folder.exists():
        for file_path in docs_folder.iterdir():
            if (file_path.suffix in [".pdf", ".docx", ".txt", ".pptx", ".xlsx"] 
                and not file_path.name.endswith(".meta.json")):
                
                meta_file = Path(str(file_path) + ".meta.json")
                if meta_file.exists():
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                else:
                    meta = {"access_level": "publico", "owner_department": "IT"}
                
                level = meta.get("access_level", "publico")
                owner = meta.get("owner_department", "IT")
                accessible = (
                    level == "publico" or
                    (level == "departamento" and owner == st.session_state["user_department"]) or
                    (level == "privado" and owner == st.session_state["user_department"])
                )
                
                if accessible:
                    size_kb = file_path.stat().st_size // 1024
                    docs_info.append({
                        "Archivo": file_path.name,
                        "Departamento": owner,
                        "Acceso": level,
                        "Tamaño (KB)": size_kb,
                        "Tipo": file_path.suffix.upper().replace(".", "")
                    })
    
    if docs_info:
        # === Búsqueda automática ===
        def update_search():
            st.session_state.search_query = st.session_state.search_input
        
        search_input = st.text_input(
            "🔍 Buscar por nombre de archivo", 
            placeholder="Ej: manual, contrato...",
            key="search_input",
            on_change=update_search,
            value=st.session_state.search_query
        )
        
        # === Filtros ===
        all_departments = sorted(list(set(doc["Departamento"] for doc in docs_info)))
        all_file_types = sorted(list(set(doc["Tipo"] for doc in docs_info)))
        
        col_dep, col_type = st.columns(2)
        with col_dep:
            selected_departments = st.multiselect(
                "Filtrar por departamento",
                options=all_departments,
                default=all_departments,
                key="dept_filter"
            )
        with col_type:
            selected_types = st.multiselect(
                "Filtrar por tipo",
                options=all_file_types,
                default=all_file_types,
                key="type_filter"
            )
        
        # === Aplicar filtros ===
        filtered_docs = docs_info
        current_search = st.session_state.search_query
        
        # Filtro por búsqueda
        if current_search.strip():
            search_lower = current_search.lower().strip()
            filtered_docs = [doc for doc in filtered_docs if search_lower in doc["Archivo"].lower()]
        
        # Filtro por departamento
        if selected_departments:
            filtered_docs = [doc for doc in filtered_docs if doc["Departamento"] in selected_departments]
        
        # Filtro por tipo
        if selected_types:
            filtered_docs = [doc for doc in filtered_docs if doc["Tipo"] in selected_types]
        
        if filtered_docs:
            # === Exportación ===
            import pandas as pd
            df_export = pd.DataFrame(filtered_docs)
            csv = df_export.to_csv(index=False).encode('utf-8')
            
            st.download_button(
                label="📥 Exportar lista filtrada a CSV",
                data=csv,
                file_name="biblioteca_hermes.csv",
                mime="text/csv",
                type="secondary"
            )
            
            # === Resultados ===
            for doc in filtered_docs:
                col1, col2, col3, col4, col5 = st.columns([3, 2, 2, 1, 1])
                col1.write(doc["Archivo"])
                col2.write(doc["Departamento"])
                col3.write(doc["Acceso"])
                col4.write(f"{doc['Tamaño (KB)']} KB")
                
                if col5.button("🗑️", key=f"del_{doc['Archivo']}", help="Eliminar"):
                    st.session_state.confirm_delete = doc["Archivo"]
                
                st.divider()
            
            st.caption(f"Mostrando {len(filtered_docs)} de {len(docs_info)} documentos")
            
            # === Confirmación de eliminación ===
            if st.session_state.confirm_delete:
                st.warning(f"¿Seguro que deseas eliminar **{st.session_state.confirm_delete}**?")
                col_a, col_b = st.columns(2)
                if col_a.button("✅ Sí, eliminar", type="primary"):
                    try:
                        from document_manager import delete_document
                        if delete_document(st.session_state.confirm_delete):
                            st.session_state.confirm_delete = None
                            st.rerun()
                        else:
                            st.error("❌ No se encontró el documento para eliminar.")
                    except Exception as e:
                        st.error(f"❌ Error al eliminar: {str(e)}")
                if col_b.button("❌ No, cancelar"):
                    st.session_state.confirm_delete = None
                    st.rerun()
        else:
            st.info("🔍 No hay documentos que coincidan con los criterios de búsqueda y filtros.")
    else:
        st.info("No tienes acceso a ningún documento. ¡Sube uno o cambia de departamento!")
        
# ==============================
# SECCIÓN: SUBIR DOCUMENTO
# ==============================
elif st.session_state.active_section == "Subir":
    st.title("📥 Subir Documento")
    
    access_options = {
        "Público (todos los departamentos)": "publico",
        "Solo mi departamento": "departamento",
        "Privado (solo el propietario)": "privado"
    }
    access_label = st.selectbox("Visibilidad", list(access_options.keys()))
    access_value = access_options[access_label]

    dept_options = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"]
    owner_dept = st.selectbox("Departamento propietario", dept_options)

    uploaded_files = st.file_uploader(
        "Elige PDF, DOCX, TXT, etc.",
        accept_multiple_files=True,
        type=["pdf", "docx", "txt", "pptx", "xlsx"]
    )

    if uploaded_files:
        # Placeholder para mensajes dinámicos
        status_placeholder = st.empty()
        
        try:
            from document_manager import (
                ensure_docs_dir, 
                get_existing_documents, 
                calculate_content_hash,
                is_duplicate,
                save_document
            )
            
            # Mostrar loading
            with status_placeholder.container():
                with st.spinner("🔄 Procesando documentos..."):
                    ensure_docs_dir()
                    existing_docs = get_existing_documents()
                    duplicates = []
                    new_files = []

                    for file in uploaded_files:
                        file_content = file.getvalue()
                        file_size = len(file_content)
                        content_hash = calculate_content_hash(file_content)
                        
                        is_dup, original_name = is_duplicate(
                            file.name, file_size, content_hash, existing_docs
                        )
                        
                        if is_dup:
                            duplicates.append(file.name)
                        else:
                            save_document(
                                file.name, 
                                file_content, 
                                access_value, 
                                owner_dept,
                                content_hash
                            )
                            new_files.append(file.name)
                            # Actualizar lista para evitar duplicados en la misma subida
                            existing_docs.append({
                                "name": file.name,
                                "size": file_size,
                                "metadata": {"content_hash": content_hash}
                            })

            # Mostrar resultados finales
            with status_placeholder.container():
                if duplicates and new_files:
                    # Mixto: algunos duplicados, algunos nuevos
                    st.warning("⚠️ Algunos archivos ya existían y fueron ignorados.")
                    new_text = "\n- ".join(new_files)
                    st.success(f"✅ Archivos nuevos guardados:\n- {new_text}")
                elif duplicates:
                    # Solo duplicados
                    dup_text = "\n- ".join(duplicates)
                    st.warning(f"⚠️ Todos los archivos ya existen:\n- {dup_text}")
                elif new_files:
                    # Solo nuevos
                    new_text = "\n- ".join(new_files)
                    st.success(f"✅ ¡Todos los archivos se guardaron correctamente!\n- {new_text}")
                else:
                    st.info("ℹ️ No se procesaron archivos.")
                
                # Añadir botón de recarga visible
                if st.button("🔄 Volver a Biblioteca", type="secondary"):
                    st.session_state.active_section = "Biblioteca"
                    st.rerun()

        except Exception as e:
            with status_placeholder.container():
                st.error(f"❌ Error al procesar los archivos: {str(e)}")
                st.button("↩️ Reintentar", on_click=lambda: st.rerun())
                
# ==============================
# SECCIÓN: MI PERFIL
# ==============================
elif st.session_state.active_section == "Perfil":
    st.title("👤 Mi Perfil")
    
    st.markdown("### 📋 Información de usuario")
    st.markdown("Selecciona tu departamento para personalizar tu experiencia.")
    
    dept_options = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"]
    
    selected_dept = st.selectbox(
        "Departamento",
        dept_options,
        index=dept_options.index(st.session_state.user_department),  # usa el valor actual
        help="Tu departamento determina qué documentos puedes ver y gestionar."
    )

    if st.button("💾 Guardar cambios", type="primary"):
        st.session_state.user_department = selected_dept
        st.success("✅ Perfil actualizado correctamente.")
    
    st.markdown("---")
    st.markdown(f"**Departamento actual:** `{st.session_state.get('user_department', 'No establecido')}`")